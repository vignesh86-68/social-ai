import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from './index';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

afterEach(() => {
  cleanup();
});

describe('administrator public routes', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('renders the admin login page for an existing regular-user session', () => {
    window.history.pushState({}, '', '/admin/login');

    render(<AppRouter />);

    expect(screen.getByRole('heading', { name: 'Administrator Sign In' })).toBeInTheDocument();
    expect(screen.queryByText('Your Feed')).not.toBeInTheDocument();
  });

  it('renders the admin login page without an authenticated session', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    window.history.pushState({}, '', '/admin/login');

    render(<AppRouter />);

    expect(screen.getByRole('heading', { name: 'Administrator Sign In' })).toBeInTheDocument();
  });

  it('renders the invitation acceptance page for an existing regular-user session', () => {
    window.history.pushState({}, '', '/admin/invitations/accept?token=test-token');

    render(<AppRouter />);

    expect(screen.getByRole('heading', { name: 'Accept administrator invitation' })).toBeInTheDocument();
  });
});
