import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ReviewQueue } from './ReviewQueue';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { review: vi.fn(), confirmReview: vi.fn(), dismissReview: vi.fn() },
}));

const mockedApi = vi.mocked(api);

beforeEach(() => vi.clearAllMocks());

describe('ReviewQueue', () => {
  it('shows the empty state when there are no suggestions', async () => {
    mockedApi.review.mockResolvedValue([]);
    render(<ReviewQueue onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No suggested connections/i)).toBeInTheDocument());
  });

  it('renders titles (not ids) and confirms an edge', async () => {
    mockedApi.review.mockResolvedValueOnce([
      {
        id: 'r1',
        source: { id: 'a1', title: 'Weekly sync' },
        target: { id: 'b2', title: 'Project Atlas' },
        confidence: 0.82,
      },
    ]);
    mockedApi.review.mockResolvedValueOnce([]);
    mockedApi.confirmReview.mockResolvedValue(undefined);
    const onChange = vi.fn();

    render(<ReviewQueue onChange={onChange} />);
    await waitFor(() => expect(screen.getByText('Weekly sync')).toBeInTheDocument());
    expect(screen.getByText('Project Atlas')).toBeInTheDocument();
    expect(screen.getByText(/Likely match/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(mockedApi.confirmReview).toHaveBeenCalledWith('r1'));
    expect(onChange).toHaveBeenCalled();
  });
});
