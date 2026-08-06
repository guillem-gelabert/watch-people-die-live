// Interpolation for dictionary strings.
//
// The dictionaries cross the server/client boundary as props, so every entry has to be plain
// JSON — no functions, no tagged templates. A `{name}` placeholder and this one helper is the
// whole substitution mechanism.

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

// One/other, which is the whole plural system English, Catalan and German need here — none of the
// counted nouns in the story fall into a language's dual or paucal.
export function plural(count: number, forms: { one: string; other: string }): string {
  return fill(count === 1 ? forms.one : forms.other, { n: count });
}
