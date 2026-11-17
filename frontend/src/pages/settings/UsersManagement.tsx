import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  UserPlus,
  Edit,
  Trash2,
  Shield,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import clsx from 'clsx';
import { format } from 'date-fns';
import { api } from '../../services/api';
import Card, { Badge, StatusDot } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore, hasRole } from '../../stores/authStore';
import { User } from '../../types';

const USER_ROLES = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SALES_REP', label: 'Sales Rep' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'FIELD_CREW', label: 'Field Crew' },
  { value: 'OFFICE_ADMIN', label: 'Office Admin' },
] as const;

type UserRole = (typeof USER_ROLES)[number]['value'];

interface UserFormValues {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string;
  password: string;
}

const initialFormValues: UserFormValues = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'SALES_REP',
  phone: '',
  password: '',
};

const roleBadgeVariant = (role: string): 'default' | 'info' | 'warning' => {
  if (role === 'OWNER') return 'warning';
  if (role === 'MANAGER') return 'info';
  return 'default';
};

const roleLabel = (role: string) => role.replace('_', ' ');

const isApiError = (err: unknown): err is { response?: { data?: { error?: string; errors?: Array<{ msg?: string }> } } } =>
  typeof err === 'object' && err !== null && 'response' in err;

const Avatar: React.FC<{ user: User }> = ({ user }) => {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.firstName}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
      {initials || <UserPlus size={14} />}
    </div>
  );
};

interface UserFormProps {
  mode: 'add' | 'edit';
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ mode, user, open, onClose }) => {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<UserFormValues>(initialFormValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (mode === 'edit' && user) {
      setValues({
        email: user.email ?? '',
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        role: (user.role as UserRole) ?? 'SALES_REP',
        phone: user.phone ?? '',
        password: '',
      });
    } else {
      setValues(initialFormValues);
    }
    setErrors({});
  }, [mode, user]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!values.email) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(values.email)) next.email = 'Invalid email address';
    if (!values.firstName.trim()) next.firstName = 'First name is required';
    if (!values.lastName.trim()) next.lastName = 'Last name is required';
    if (mode === 'add' && !values.password) next.password = 'Password is required';
    else if (values.password && values.password.length < 8)
      next.password = 'Password must be at least 8 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleField = (field: keyof UserFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const createUserMutation = useMutation({
    mutationFn: (payload: UserFormValues) =>
      api
        .post('/auth/users', {
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: payload.role,
          password: payload.password,
        })
        .then((res) => res.data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(
        isApiError(err)
          ? err.response?.data?.errors?.[0]?.msg ||
            err.response?.data?.error ||
            'Failed to create user'
          : 'Failed to create user'
      );
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UserFormValues) => {
      const body: Record<string, unknown> = {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        phone: payload.phone || undefined,
      };
      if (payload.password) body.password = payload.password;
      return api
        .patch(`/auth/users/${id}`, body)
        .then((res) => res.data.user);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(
        isApiError(err)
          ? err.response?.data?.errors?.[0]?.msg ||
            err.response?.data?.error ||
            'Failed to update user'
          : 'Failed to update user'
      );
    },
  });

  const submitting = createUserMutation.isPending || updateUserMutation.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (mode === 'add') {
      createUserMutation.mutate(values);
    } else if (mode === 'edit' && user) {
      updateUserMutation.mutate({ id: user.id, ...values });
    }
  };

  const title = mode === 'add' ? 'Add User' : 'Edit User';
  const submitLabel = mode === 'add' ? 'Create' : 'Save';

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[hsl(var(--background-card))] p-6 shadow-xl focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-lg font-semibold text-text-primary">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {mode === 'add'
              ? 'Invite a new team member to your company.'
              : "Update this user's details."}
          </Dialog.Description>

          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Email</label>
              <input
                type="email"
                className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={values.email}
                onChange={(e) => handleField('email', e.target.value)}
                placeholder="user@company.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">First name</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={values.firstName}
                  onChange={(e) => handleField('firstName', e.target.value)}
                  placeholder="Jane"
                />
                {errors.firstName && <p className="mt-1 text-xs text-red">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Last name</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={values.lastName}
                  onChange={(e) => handleField('lastName', e.target.value)}
                  placeholder="Doe"
                />
                {errors.lastName && <p className="mt-1 text-xs text-red">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Role</label>
              <select
                className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={values.role}
                onChange={(e) => handleField('role', e.target.value as UserRole)}
              >
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Phone</label>
              <input
                type="tel"
                className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={values.phone}
                onChange={(e) => handleField('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Password</label>
              <input
                type="password"
                className="mt-1 block w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={values.password}
                onChange={(e) => handleField('password', e.target.value)}
                placeholder={
                  mode === 'add'
                    ? 'Minimum 8 characters'
                    : 'Leave blank to keep current password'
                }
              />
              {errors.password && <p className="mt-1 text-xs text-red">{errors.password}</p>}
            </div>
          </form>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const UsersManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formUser, setFormUser] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users').then((res) => res.data.users as User[]),
    enabled: hasRole(['OWNER', 'MANAGER']),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api
        .patch(`/auth/users/${userId}/toggle-status`, { isActive })
        .then((res) => res.data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User status updated');
    },
    onError: (err: unknown) => {
      toast.error(
        isApiError(err)
          ? err.response?.data?.error || 'Failed to update user status'
          : 'Failed to update user status'
      );
    },
  });

  const openAddForm = () => {
    setFormMode('add');
    setFormUser(null);
    setFormOpen(true);
  };

  const openEditForm = (u: User) => {
    setFormMode('edit');
    setFormUser(u);
    setFormOpen(true);
  };

  const requestDeactivate = (u: User) => {
    setUserToDeactivate(u);
    setConfirmOpen(true);
  };

  const handleToggleStatus = (u: User) => {
    if (u.isActive) {
      // Deactivating requires confirmation
      requestDeactivate(u);
    } else {
      // Reactivating is applied directly
      toggleMutation.mutate({ userId: u.id, isActive: true });
    }
  };

  const confirmDeactivate = () => {
    if (userToDeactivate) {
      toggleMutation.mutate({ userId: userToDeactivate.id, isActive: false });
    }
    setConfirmOpen(false);
  };

  const isLoadingAction = toggleMutation.isPending;

  // OWNER / MANAGER authorization gate (backend enforces this too)
  if (!hasRole(['OWNER', 'MANAGER'])) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-[hsl(var(--background-card))]">
        <Shield size={40} className="text-red" />
        <h2 className="text-xl font-semibold text-text-primary">Access denied</h2>
        <p className="text-sm text-text-secondary">
          Only owners and managers can manage company users.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-text-secondary">
            Manage who has access to your AUCTUM workspace.
          </p>
        </div>
        <Button onClick={openAddForm} leftIcon={<UserPlus size={16} />}>
          Add User
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">
                    <Loader2 size={24} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red">
                    Failed to load users.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">
                    No users found. Invite your first team member.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-[hsl(var(--background-accent))]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <span className="font-medium text-text-primary">
                          {u.firstName} {u.lastName}
                          {u.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-text-tertiary">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleBadgeVariant(u.role)} size="sm">
                        {roleLabel(u.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot
                          status={u.isActive ? 'ACTIVE' : 'CANCELLED'}
                          size="sm"
                        />
                        <span className="text-sm text-text-primary">
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          disabled={isLoadingAction}
                          className={clsx(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors outline-none disabled:opacity-50',
                            u.isActive ? 'bg-emerald' : 'bg-text-tertiary',
                            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                          )}
                          aria-label={u.isActive ? 'Deactivate user' : 'Reactivate user'}
                          title={u.isActive ? 'Deactivate user' : 'Reactivate user'}
                        >
                          <span
                            className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition',
                              u.isActive ? 'translate-x-5' : 'translate-x-1',
                            )}
                          />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-tertiary">
                      {u.createdAt ? format(new Date(u.createdAt), 'PP') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => openEditForm(u)}
                          className="rounded-lg p-1.5 text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                          aria-label="Edit user"
                          title="Edit user"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit user form */}
      <UserForm
        mode={formMode}
        user={formUser}
        open={formOpen}
        onOpenChange={setFormOpen}
        onClose={() => setFormOpen(false)}
      />

      {/* Deactivate confirmation */}
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[hsl(var(--background-card))] p-6 shadow-xl focus:outline-none"
            aria-describedby={undefined}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red/10 text-red">
                <AlertTriangle size={20} />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-text-primary">
                  Deactivate user
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-text-secondary">
                  Are you sure you want to deactivate{' '}
                  <span className="font-medium text-text-primary">
                    {userToDeactivate?.firstName} {userToDeactivate?.lastName}
                  </span>
                  ? They will be signed out and will no longer be able to log in until
                  reactivated.
                </Dialog.Description>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="button"
                onClick={confirmDeactivate}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                <Trash2 size={14} />
                Deactivate
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default UsersManagement;

