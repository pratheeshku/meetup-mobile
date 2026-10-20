import React from 'react';
import { render, texts } from '../../../test-utils/render';
import ResponsesSection from '../ResponsesSection';
import type { ResponsesResponse } from '../../../types/event';

describe('ResponsesSection', () => {
  const mockResponses: ResponsesResponse = {
    accepted: {
      total: 2,
      items: [
        { user_id: 'u1', display_name: 'Alice', photo_url: null, waitlisted: false },
        { user_id: 'u2', display_name: 'Bob', photo_url: null, waitlisted: true },
      ],
    },
    pending: {
      total: 2,
      items: [
        { user_id: 'u3', display_name: 'Charlie', email: 'charlie@example.com' },
        { user_id: null, display_name: '', email: 'unclaimed@example.com' },
      ],
    },
    declined: {
      total: 3,
      items: [
        { user_id: 'u4', display_name: 'David', via: 'invitation' },
        { user_id: 'u5', display_name: 'Eve', via: 'public' },
        { user_id: 'u6', display_name: 'Frank', via: 'joined' },
      ],
    },
  };

  it('renders null when responses is null', () => {
    const root = render(<ResponsesSection responses={null} />);
    expect(texts(root)).toEqual([]);
  });

  it('renders all 3 sections with totals and names', () => {
    const root = render(<ResponsesSection responses={mockResponses} />);
    const content = texts(root).join(' ');

    expect(content).toContain('Responses');
    expect(content).toContain('Accepted');
    expect(content).toContain('Pending');
    expect(content).toContain('Declined');

    // Names
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
    expect(content).toContain('Charlie');
    expect(content).toContain('unclaimed@example.com');
    expect(content).toContain('David');
    expect(content).toContain('Eve');
    expect(content).toContain('Frank');

    // Tags
    expect(content).toContain('Waitlisted');
    expect(content).toContain('Invited');
    expect(content).toContain('Public');
    expect(content).toContain('Joined');
  });

  it('renders empty messages when sections are empty', () => {
    const emptyResponses: ResponsesResponse = {
      accepted: { total: 0, items: [] },
      pending: { total: 0, items: [] },
      declined: { total: 0, items: [] },
    };

    const root = render(<ResponsesSection responses={emptyResponses} />);
    const content = texts(root).join(' ');

    expect(content).toContain('No one yet');
    expect(content).toContain('No one has declined');
  });
});
