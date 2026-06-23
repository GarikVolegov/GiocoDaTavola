// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CardGrid } from './CardGrid';

describe('CardGrid', () => {
  afterEach(() => cleanup());

  it('renders its children inside a single grid container', () => {
    render(
      <CardGrid aria-label="punteggi">
        <div>uno</div>
        <div>due</div>
        <div>tre</div>
      </CardGrid>,
    );
    const grid = screen.getByLabelText('punteggi');
    expect(grid).toBeInTheDocument();
    expect(grid.children).toHaveLength(3);
  });

  it('exposes the min-column size as a CSS variable so columns stay equal', () => {
    render(
      <CardGrid min={10} aria-label="g">
        <div>x</div>
      </CardGrid>,
    );
    expect(screen.getByLabelText('g').style.getPropertyValue('--cg-min')).toBe('10rem');
  });
});
