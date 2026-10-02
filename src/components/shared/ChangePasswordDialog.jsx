// Change Password Dialog - anyone can change their own password.
// The current password is verified first (Firebase requires a recent sign-in), and
// every problem is shown beside the field it belongs to.

import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PasswordField from '@/components/shared/PasswordField';
import { auth } from '@/config/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { passwordProblem } from '@/lib/password';
import { reportError } from '@/lib/reportError';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

const ChangePasswordDialog = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Fixing a field clears its error, and only its error.
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _fixed, ...rest } = prev;
      return rest;
    });
  };

  const close = () => {
    onOpenChange(false);
    setFormData(EMPTY);
    setErrors({});
  };

  const validate = () => {
    const problems = {};
    if (!formData.currentPassword) problems.currentPassword = 'Enter your current password.';
    const weak = passwordProblem(formData.newPassword);
    if (weak) problems.newPassword = weak;
    else if (formData.newPassword === formData.currentPassword) {
      problems.newPassword = 'Choose a password that is different from your current one.';
    }
    if (!formData.confirmPassword) problems.confirmPassword = 'Type the new password again to confirm it.';
    else if (formData.confirmPassword !== formData.newPassword) problems.confirmPassword = 'The two passwords do not match.';
    return problems;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const problems = validate();
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No user is currently logged in.');
      }

      // Re-authenticate with the current password, then update.
      const credential = EmailAuthProvider.credential(user.email, formData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, formData.newPassword);

      toast({
        title: 'Password changed',
        description: 'Use your new password the next time you sign in.',
      });
      close();
    } catch (error) {
      // Modern Firebase reports a wrong password as invalid-credential.
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrors({ currentPassword: 'That is not your current password. Check it and try again.' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ newPassword: 'That password is too weak. Use a longer one with a mix of letters and numbers.' });
      } else if (error.code === 'auth/requires-recent-login') {
        reportError(error, { title: 'Please sign in again', fallback: 'For your security, sign out and sign back in, then change your password.' });
      } else {
        reportError(error, { title: 'Could not change password', fallback: 'Failed to change password. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span>Change Password</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update your password to keep your account secure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={formData.currentPassword}
            onChange={(v) => handleInputChange('currentPassword', v)}
            autoComplete="current-password"
            showStrength={false}
            hint=""
            error={errors.currentPassword}
            disabled={loading}
            autoFocus
          />

          <PasswordField
            id="newPassword"
            label="New password"
            value={formData.newPassword}
            onChange={(v) => handleInputChange('newPassword', v)}
            error={errors.newPassword}
            disabled={loading}
            email={auth.currentUser?.email || ''}
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={formData.confirmPassword}
            onChange={(v) => handleInputChange('confirmPassword', v)}
            showStrength={false}
            hint=""
            error={errors.confirmPassword}
            disabled={loading}
          />

          <DialogFooter className="flex space-x-2">
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                    aria-hidden="true"
                  />
                  Updating…
                </>
              ) : (
                <>
                  <KeyRound aria-hidden="true" />
                  Change password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
