// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Celebration from './Celebration';

describe('Celebration', () => {
  afterEach(() => cleanup());

  it('renders a decorative (aria-hidden) overlay with the requested number of pieces', () => {
    const { container } = render(<Celebration pieces={6} />);
    const root = container.firstChild as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('span').length).toBe(6);
  });
});
