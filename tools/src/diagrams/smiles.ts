import * as OCL from 'openchemlib';

export type SmilesOptions = {
  /** Accessible name for the SVG (becomes aria-label). */
  label?: string;
  /** Unique id prefix so several SVGs can share one page. */
  id?: string;
  /** Source file, named in error messages. */
  file?: string;
  width?: number;
  height?: number;
};

export class SmilesError extends Error {}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ELEMENTS = new Set(
  ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru ' +
    'Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn ' +
    'Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '),
);
const AROMATIC_BRACKET = new Set(['b', 'c', 'n', 'o', 'p', 's', 'se', 'as']);
// isotope, symbol, chirality, hydrogens, charge, atom class
const BRACKET_ATOM =
  /^\[(\d+)?(\*|[A-Z][a-z]?|[a-z]{1,2})(@@?|@(?:TH|AL)[12]|@SP[123]|@TB\d{1,2}|@OH\d{1,2})?(H\d*)?(\+\+|--|[+-]\d{0,2})?(:\d+)?\]$/;
const TOKEN = /\[[^\]]*\]|Br|Cl|[BCNOPSFIbcnops*]|%\d\d|\d|[-=#$:/\\]|[().]/y;

/**
 * Validate a SMILES string against the OpenSMILES grammar before depiction (OpenChemLib silently
 * normalizes some malformed input). Throws SmilesError describing the first problem found.
 */
export function validateSmiles(smiles: string, file?: string): void {
  const src = smiles.trim();
  const prefix = file ? `${file}: ` : '';
  const fail = (why: string): never => {
    throw new SmilesError(`${prefix}invalid SMILES "${src}": ${why}`);
  };
  if (!src) throw new SmilesError(`${prefix}empty SMILES string`);
  if (/\s/.test(src)) fail('contains whitespace');

  let atoms = 0;
  let prev = 0; // 1-based index of the atom the next atom bonds to; 0 at the start or after a dot
  let bond: string | null = null; // explicit bond symbol waiting for its right-hand side
  let branchStart = false; // just after "(" with no atom yet
  let dotInBranch = false;
  const stack: number[] = [];
  const bonded = new Set<string>();
  const rings = new Map<string, { atom: number; bond: string | null }>();
  const addBond = (a: number, b: number, via?: string) => {
    const closure = via ? ` (ring closure ${via})` : '';
    if (a === b) fail(`atom ${a} is bonded to itself${closure}`);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (bonded.has(`${lo}-${hi}`)) fail(`duplicate bond between atoms ${lo} and ${hi}${closure}`);
    bonded.add(`${lo}-${hi}`);
  };

  let i = 0;
  while (i < src.length) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(src);
    if (!m) {
      if (src[i] === '[') return fail(`unterminated bracket atom at position ${i + 1}`);
      return fail(`unexpected character "${src[i]}" at position ${i + 1}`);
    }
    const tok = m[0];
    i += tok.length;

    if (tok === '(') {
      if (!prev) fail('branch without a preceding atom');
      if (bond) fail(`bond "${bond}" before "("`);
      stack.push(prev);
      branchStart = true;
      dotInBranch = false;
    } else if (tok === ')') {
      if (!stack.length) fail('unbalanced parentheses: unmatched ")"');
      if (bond) fail(`bond "${bond}" before ")"`);
      if (branchStart || !prev) fail('branch with no atoms');
      prev = stack.pop()!;
      branchStart = false;
    } else if (tok === '.') {
      if (bond) fail(`bond "${bond}" before "."`);
      if (!prev && !(branchStart && !dotInBranch)) fail('misplaced "." (leading, repeated or dangling)');
      if (branchStart) dotInBranch = true;
      prev = 0;
    } else if (/^[-=#$:/\\]$/.test(tok)) {
      if (bond) fail(`repeated bond symbols "${bond}${tok}"`);
      if (!prev) fail(`bond "${tok}" without a preceding atom`);
      bond = tok;
    } else if (/^(%\d\d|\d)$/.test(tok)) {
      const digit = tok.replace('%', '');
      if (branchStart) fail(`ring bond ${tok} cannot be the first token of a branch`);
      if (!prev) fail(`ring bond ${tok} without a preceding atom`);
      const open = rings.get(digit);
      if (open) {
        if (open.bond && bond && open.bond !== bond && !/[/\\]/.test(open.bond + bond))
          fail(`ring closure ${digit} has conflicting bond symbols "${open.bond}" and "${bond}"`);
        addBond(open.atom, prev, digit);
        rings.delete(digit);
      } else {
        rings.set(digit, { atom: prev, bond });
      }
      bond = null;
    } else {
      if (tok.startsWith('[')) {
        const b = BRACKET_ATOM.exec(tok);
        if (!b) fail(`bad bracket atom ${tok}`);
        const sym = b![2]!;
        if (sym !== '*' && !ELEMENTS.has(sym) && !AROMATIC_BRACKET.has(sym))
          fail(`unknown element symbol "${sym}" in ${tok}`);
      }
      atoms++;
      if (prev) addBond(prev, atoms);
      prev = atoms;
      bond = null;
      branchStart = false;
    }
  }
  if (src.endsWith('.')) fail('dangling "."');
  if (bond) fail(`ends with a dangling bond "${bond}"`);
  if (stack.length) fail('unbalanced parentheses: unclosed "("');
  if (!atoms) fail('no atoms');
  if (rings.size) fail(`unclosed ring bond${rings.size > 1 ? 's' : ''} ${[...rings.keys()].join(', ')}`);
}

/** Render a SMILES string to a deterministic inline SVG. Throws on invalid input (naming `file` when given). */
export function renderSmilesToSvg(smiles: string, optsOrFile: SmilesOptions | string = {}): string {
  const opts: SmilesOptions = typeof optsOrFile === 'string' ? { file: optsOrFile } : optsOrFile;
  const src = smiles.trim();
  validateSmiles(src, opts.file);
  const prefix = opts.file ? `${opts.file}: ` : '';
  let mol;
  try {
    mol = OCL.Molecule.fromSmiles(src);
    try {
      mol.validate();
    } catch (e) {
      // A lone ion (e.g. acetate) is legitimate to draw, so net-charge balance is not an error here.
      if (!/unbalanced atom charge/.test(String(e))) throw e;
    }
  } catch (e) {
    throw new SmilesError(`${prefix}invalid SMILES "${src}": ${e instanceof Error ? e.message : String(e)}`);
  }
  if (mol.getAllAtoms() === 0) throw new SmilesError(`${prefix}invalid SMILES "${src}": no atoms`);
  const svg = mol.toSVG(opts.width ?? 300, opts.height ?? 200, opts.id ?? 'smiles');
  const attrs = `role="img"${opts.label ? ` aria-label="${escapeAttr(opts.label)}"` : ''}`;
  return svg.replace(/^<svg /, `<svg ${attrs} `);
}
