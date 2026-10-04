import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalBrandingCard from './PortalBrandingCard';

const mocks = vi.hoisted(() => ({
  getBranding: vi.fn(),
  saveBranding: vi.fn(),
  shrink: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/services/brandingService', () => ({ getBranding: mocks.getBranding, saveBranding: mocks.saveBranding }));
vi.mock('@/services/organizationService', () => ({ getOrganizationById: async () => ({ name: 'Acme Builders' }) }));
vi.mock('@/lib/imageResize', () => ({ shrinkImageToDataUrl: mocks.shrink }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBranding.mockResolvedValue({ accent: null, logo: null, welcome: '' });
  mocks.saveBranding.mockImplementation(async (_org, b) => b);
  mocks.shrink.mockResolvedValue(LOGO);
});

describe('PortalBrandingCard', () => {
  test('previews the portal bar with the organisation name and saves a colour, logo and note', async () => {
    const user = userEvent.setup();
    render(<PortalBrandingCard orgId="org1" />);
    expect(await screen.findByText('Acme Builders')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Accent colour'), '#0f766e');
    await user.upload(screen.getByLabelText('Logo'), new File(['x'], 'logo.png', { type: 'image/png' }));
    expect(await screen.findByAltText('Acme Builders logo')).toHaveAttribute('src', LOGO);
    await user.type(screen.getByLabelText('Welcome note'), 'Welcome to your projects');
    expect(screen.getAllByText('Welcome to your projects').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Save branding' }));
    await waitFor(() => expect(mocks.saveBranding).toHaveBeenCalledWith('org1', {
      accent: '#0f766e', logo: LOGO, welcome: 'Welcome to your projects',
    }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Portal branding saved' }));
  });

  test('a colour that is not a colour is caught next to the field', async () => {
    const user = userEvent.setup();
    render(<PortalBrandingCard orgId="org1" />);
    await screen.findByText('Acme Builders');
    await user.type(screen.getByLabelText('Accent colour'), 'teal');
    await user.click(screen.getByRole('button', { name: 'Save branding' }));
    expect(screen.getByText(/Use a hex colour/)).toBeInTheDocument();
    expect(screen.getByLabelText('Accent colour')).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.saveBranding).not.toHaveBeenCalled();
  });

  test('an image that will not fit is refused with a reason', async () => {
    mocks.shrink.mockResolvedValue(`data:image/webp;base64,${'A'.repeat(200000)}`);
    const user = userEvent.setup();
    render(<PortalBrandingCard orgId="org1" />);
    await screen.findByText('Acme Builders');
    await user.upload(screen.getByLabelText('Logo'), new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText(/too detailed/)).toBeInTheDocument();
  });

  test('the saved branding is loaded, and the logo can be removed', async () => {
    mocks.getBranding.mockResolvedValue({ accent: '#1d4ed8', logo: LOGO, welcome: 'Hi' });
    const user = userEvent.setup();
    render(<PortalBrandingCard orgId="org1" />);
    await waitFor(() => expect(screen.getByLabelText('Accent colour')).toHaveValue('#1d4ed8'));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByAltText('Acme Builders logo')).not.toBeInTheDocument();
  });
});
