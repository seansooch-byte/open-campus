import { describe, expect, it } from 'vitest';
import { renderSmilesToSvg } from '../src/diagrams/index.js';

describe('renderSmilesToSvg', () => {
  it('renders glycine to an accessible inline svg', () => {
    const svg = renderSmilesToSvg('NCC(=O)O', { label: 'Glycine structure' });
    expect(svg).toMatch(/^<svg role="img" aria-label="Glycine structure" /);
    expect(svg).toContain('</svg>');
  });
  it('is deterministic', () => {
    expect(renderSmilesToSvg('NCC(=O)O')).toBe(renderSmilesToSvg('NCC(=O)O'));
  });
  it('escapes the label', () => {
    expect(renderSmilesToSvg('CC', { label: 'a "b" <c>' })).toContain('aria-label="a &quot;b&quot; &lt;c&gt;"');
  });
  it('rejects invalid SMILES', () => {
    expect(() => renderSmilesToSvg('N(C(')).toThrow(/invalid SMILES/);
    expect(() => renderSmilesToSvg('not a smiles!!')).toThrow(/invalid SMILES/);
    expect(() => renderSmilesToSvg('  ')).toThrow(/empty/);
    expect(() => renderSmilesToSvg('C()')).toThrow(/branch with no atoms/);
    expect(() => renderSmilesToSvg('C\nN')).toThrow(/whitespace/);
    expect(() => renderSmilesToSvg('C(C)(C)(C)(C)C')).toThrow(/valence/);
  });
  it('rejects duplicate bonds, naming the input', () => {
    expect(() => renderSmilesToSvg('C1C1')).toThrow(
      'invalid SMILES "C1C1": duplicate bond between atoms 1 and 2 (ring closure 1)',
    );
    expect(() => renderSmilesToSvg('C12CC12')).toThrow(/invalid SMILES "C12CC12"/);  });
  it('rejects a ring bond as the first token of a branch', () => {
    expect(() => renderSmilesToSvg('C(1)CCCCC1')).toThrow(/invalid SMILES "C\(1\)CCCCC1".*first token of a branch/);
  });
  it('rejects unclosed rings, bad parentheses, bad dots, bad atoms', () => {
    const cases: [string, RegExp][] = [
      ['C1CCCC', /unclosed ring bond 1/],
      ['C(C', /unclosed "\("/],
      ['CC)', /unmatched "\)"/],
      ['C(())C', /branch without a preceding atom|branch with no atoms/],
      ['.C', /misplaced "\."/],
      ['C.', /dangling "\."/],
      ['C..C', /misplaced "\."/],
      ['C(..C)', /misplaced "\."/],
      ['(C)C', /branch without a preceding atom/],
      ['C(C=)', /bond "=" before "\)"/],
      ['C==C', /repeated bond/],
      ['[Xx]C', /unknown element symbol "Xx"/],
      ['[NH3+C', /unterminated bracket atom/],
      ['[N+H3]', /bad bracket atom/],
    ];
    for (const [bad, re] of cases) expect(() => renderSmilesToSvg(bad), bad).toThrow(re);
  });
  it('names the file in the error when given', () => {
    const file = 'content/subjects/x/y/diagrams/x.smi';
    expect(() => renderSmilesToSvg('C1C1', file)).toThrow(`${file}: invalid SMILES "C1C1": duplicate bond`);
    expect(() => renderSmilesToSvg('C1C1', { file })).toThrow(new RegExp(`^${file.replace(/\./g, '\\.')}: invalid SMILES`));
  });
  it('accepts valid inputs', () => {
    for (const ok of [
      'CC',
      'C1CCCCC1',
      'NCC(=O)O',
      'C(.C)',
      '[NH3+]CC(=O)[O-]',
      'c1ccccc1',
      '[Na+].[Cl-]',
      'CC(C(C)C)C(=O)O',
      'C1CC(C)CC1',
      'C%10CCCCC%10',
      'N[C@@H](C)C(=O)O',
    ])
      expect(renderSmilesToSvg(ok), ok).toContain('<svg');
  });
  it('still renders a lone ion', () => {
    expect(renderSmilesToSvg('CC(=O)[O-]')).toContain('<svg');
  });
});
