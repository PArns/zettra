import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BlockDto } from '@zettra/shared';
import { BlockSource, BlockVisibility } from '@zettra/shared';
import { InboxPane } from './InboxPane';

function block(id: string, text: string): BlockDto {
  return {
    id,
    tenantId: 't1',
    spaceId: 's1',
    parentId: null,
    position: 'a0',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    source: BlockSource.WebClip,
    sourceRef: null,
    visibility: BlockVisibility.Space,
    ownerUserId: 'u1',
    createdBy: 'u1',
    createdAt: new Date('2026-07-09T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-07-09T12:00:00Z').toISOString(),
    tagIds: [],
  };
}

describe('InboxPane', () => {
  it('shows an empty state when there are no blocks', () => {
    render(<InboxPane blocks={[]} onOpen={() => {}} />);
    expect(screen.getByText(/Briefkasten is empty/i)).toBeInTheDocument();
  });

  it('renders each block title and source', () => {
    render(
      <InboxPane
        blocks={[block('b1', 'First note'), block('b2', 'Second note')]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('First note', { selector: '.title' })).toBeInTheDocument();
    expect(screen.getByText('Second note', { selector: '.title' })).toBeInTheDocument();
    expect(screen.getAllByText('web_clip').length).toBe(2);
  });

  it('calls onOpen with the block id when clicked', () => {
    const onOpen = vi.fn();
    render(<InboxPane blocks={[block('b1', 'Clickable')]} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Clickable', { selector: '.title' }));
    expect(onOpen).toHaveBeenCalledWith('b1');
  });
});
