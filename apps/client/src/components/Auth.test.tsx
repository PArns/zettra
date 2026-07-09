import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Auth } from './Auth';
import { api, setToken } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { register: vi.fn(), login: vi.fn() },
  setToken: vi.fn(),
}));

const mockedApi = vi.mocked(api);
const mockedSetToken = vi.mocked(setToken);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth', () => {
  it('registers a new workspace and stores the token', async () => {
    mockedApi.register.mockResolvedValue({
      accessToken: 'jwt-123',
      user: { id: 'u1', tenantId: 't1', email: 'a@b.c', displayName: null },
    });
    const onAuthed = vi.fn();
    render(<Auth onAuthed={onAuthed} />);

    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: 'a@b.c' },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 8/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => expect(mockedApi.register).toHaveBeenCalledOnce());
    expect(mockedSetToken).toHaveBeenCalledWith('jwt-123');
    expect(onAuthed).toHaveBeenCalled();
  });

  it('login form is email-first — no workspace UUID field', () => {
    render(<Auth onAuthed={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /sign in/i }));
    expect(screen.queryByText(/Workspace ID/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
  });

  it('surfaces an error when the API rejects', async () => {
    mockedApi.login.mockRejectedValue(new Error('API 401: bad creds'));
    const { container } = render(<Auth onAuthed={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: /sign in/i }));
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: 'a@b.c' },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 8/i), { target: { value: 'pw' } });
    // In login mode both the segment toggle and the submit read "Sign in"; submit the form.
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(screen.getByText(/API 401/)).toBeInTheDocument());
  });
});
