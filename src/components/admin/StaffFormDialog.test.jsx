import React, { useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffFormDialog from './StaffFormDialog';

const EMPTY = { name: '', email: '', password: '', designation: '', status: 'active', departmentId: '', projectId: '' };

const Harness = ({ onSubmit, errors, mode = 'add', initial = EMPTY }) => {
  const [formData, setFormData] = useState(initial);
  return (
    <StaffFormDialog
      open
      mode={mode}
      onOpenChange={() => {}}
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      designations={[{ id: 'd1', name: 'Designer' }]}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />
  );
};

describe('StaffFormDialog', () => {
  test('Enter in a field submits the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/^Name/), 'Sana Staff{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('shows the errors it is given beside the right fields', () => {
    render(<Harness onSubmit={() => {}} errors={{ name: 'Enter a name.', password: 'Use at least 8 characters (this has 3).' }} />);
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/this has 3/)).toBeInTheDocument();
  });

  test('the password can be generated and revealed', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => {}} />);
    await user.click(screen.getByRole('button', { name: /generate/i }));
    const field = screen.getByLabelText(/^Password/);
    expect(field).toHaveAttribute('type', 'text');
    expect(field.value).toHaveLength(14);
  });

  test('every select is labelled', () => {
    render(<Harness onSubmit={() => {}} />);
    for (const name of ['Designation', 'Department', 'Project']) {
      expect(screen.getByRole('combobox', { name })).toBeInTheDocument();
    }
  });

  test('editing has no password field, and the email is fixed', () => {
    render(<Harness mode="edit" initial={{ ...EMPTY, name: 'Sana', email: 'sana@demo.test' }} onSubmit={() => {}} />);
    expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
  });
});
