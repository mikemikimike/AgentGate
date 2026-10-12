import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { VerdictBadge } from '../src/components/VerdictBadge';

describe('VerdictBadge', () => {
  it('renders correctly', () => {
    const { getByText } = render(<VerdictBadge verdict="allow" />);
    expect(getByText('Allow')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<VerdictBadge verdict="deny" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
