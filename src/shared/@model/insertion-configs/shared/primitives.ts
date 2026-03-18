import { z } from "zod/mini";

export const elementSelectorSchema = z.string().brand("ElementSelector");
/** @public */
export type ElementSelector = z.infer<typeof elementSelectorSchema>;

export const elementListSelectorSchema = z
  .string()
  .brand("ElementListSelector");
/** @public */
export type ElementListSelector = z.infer<typeof elementListSelectorSchema>;

export const attributeSchema = z.string().brand("Attribute");
/** @public */
export type Attribute = z.infer<typeof attributeSchema>;

/**
 * Points to a prop in a react component that wraps the given DOM element
 * Resolution is async so should be used if the same data is not available
 * in DOM attribute.
 *
 * Traverses up to 16 components wrapping the given DOM element. Traversal stops
 * as soon as a value is encountered. All extracted values are converted to strings
 * for compatibility with attribute selectors.
 *
 * @example "*:foo" - React component with any name, prop name 'foo'
 * @example "Example:foo" - React component named 'Example', prop name 'foo'
 * @example "Example:foo/bar" - React component named 'Example', prop name 'foo' (JSON object) → field 'bar'
 * @example "*:foo/bar/baz" - React component with any name, prop name 'foo' (JSON object) → field 'bar' → field 'baz'
 */
export const reactPropSchema = z.string().brand("ReactProp");
/** @public */
export type ReactProp = z.infer<typeof reactPropSchema>;

/**
 * If provided, filters the value by a stringified regular expression.
 * If regular expression contains capturing groups, the first group is extracted.
 * Otherwise, the entire value is returned.
 *
 * If regular expression is invalid, the value is not extracted and a warning is logged.
 *
 * @example String.raw`^\d+$` - Returns a stringified positive integer only if the entire string is digits-only
 * @example String.raw`(-?\d+)` - Returns the first match of an integer number
 */
export const valuePatternSchema = z.string().brand("ValuePattern");
/** @public */
export type ValuePattern = z.infer<typeof valuePatternSchema>;

export const placementPositionSchema = z.enum([
  "before",
  "after",
  "prepend",
  "append",
]);

function allowMultiple<Schema extends z.ZodMiniType>(schema: Schema) {
  return z.union([schema, z.readonly(z.array(schema))]);
}

const singleElementCountSelectorSchema = z.union([
  elementListSelectorSchema,
  z.readonly(
    z.object({
      selector: elementListSelectorSchema,
    }),
  ),
]);
export const elementCountSelectorSchema = allowMultiple(
  singleElementCountSelectorSchema,
);
export type ElementCountSelector = z.infer<typeof elementCountSelectorSchema>;

const singleElementPresenceSelectorSchema = singleElementCountSelectorSchema;
export const elementPresenceSelectorSchema = allowMultiple(
  singleElementPresenceSelectorSchema,
);
export type ElementPresenceSelector = z.infer<
  typeof elementPresenceSelectorSchema
>;

const singleImageUrlSelectorSchema = z.union([
  elementSelectorSchema,
  z.readonly(
    z.object({
      selector: elementSelectorSchema,
    }),
  ),
]);

export const imageUrlSelectorSchema = allowMultiple(
  singleImageUrlSelectorSchema,
);
export type ImageUrlSelector = z.infer<typeof imageUrlSelectorSchema>;

const pipeSchema: z.ZodMiniExactOptional<
  z.ZodMiniLazy<z.ZodMiniType<StringDataSelector, StringDataSelectorInput>>
> = z.exactOptional(
  // eslint-disable-next-line @typescript-eslint/no-use-before-define -- z.lazy requires forward reference
  z.lazy(() => stringDataSelectorSchema),
);

const sharedStringDataSelectorShape = {
  ancestorSelector: z.exactOptional(elementSelectorSchema),
  selector: elementSelectorSchema,
  valuePattern: z.exactOptional(valuePatternSchema),
  pipe: pipeSchema,
};

const singleStringDataSelectorSchema = z.xor([
  elementSelectorSchema,
  z.readonly(
    z.object({
      ...sharedStringDataSelectorShape,
      reactProp: reactPropSchema,
      attribute: z.exactOptional(z.never()),
    }),
  ),
  z.readonly(
    z.object({
      ...sharedStringDataSelectorShape,
      attribute: z.exactOptional(attributeSchema),
      reactProp: z.exactOptional(z.never()),
    }),
  ),
]);

/**
 * Flexible text/attribute/reactProp extraction from DOM.
 * - Shorthand: string CSS selector → extract textContent from DOM element
 * - Object form: selector + optional parent selector (applies before selector) + optional attribute or react prop
 * - pipe: optional chaining — result of current step is substituted for `%` in the pipe step's fields
 */
export const stringDataSelectorSchema = allowMultiple(
  singleStringDataSelectorSchema,
);

type SingleStringDataSelectorInput =
  | string
  | Readonly<{
      ancestorSelector?: string;
      selector: string;
      valuePattern?: string;
      reactProp: string;
      attribute?: never;
      pipe?: StringDataSelectorInput;
    }>
  | Readonly<{
      ancestorSelector?: string;
      selector: string;
      valuePattern?: string;
      attribute?: string;
      reactProp?: never;
      pipe?: StringDataSelectorInput;
    }>;

type StringDataSelectorInput =
  | SingleStringDataSelectorInput
  | readonly StringDataSelectorInput[];

type SingleStringDataSelector =
  | ElementSelector
  | Readonly<{
      ancestorSelector?: ElementSelector;
      selector: ElementSelector;
      valuePattern?: ValuePattern;
      reactProp: ReactProp;
      attribute?: never;
      pipe?: StringDataSelector;
    }>
  | Readonly<{
      ancestorSelector?: ElementSelector;
      selector: ElementSelector;
      valuePattern?: ValuePattern;
      attribute?: Attribute;
      reactProp?: never;
      pipe?: StringDataSelector;
    }>;

export type StringDataSelector =
  | SingleStringDataSelector
  | readonly StringDataSelector[];

// Compile-time checks: manual types must stay in sync with schema inference
type InferredOutput = z.infer<typeof stringDataSelectorSchema>;
type InferredInput = z.input<typeof stringDataSelectorSchema>;
type AssertOutputAssignable = InferredOutput extends StringDataSelector
  ? StringDataSelector extends InferredOutput
    ? true
    : "StringDataSelector is wider than schema output"
  : "Schema output is wider than StringDataSelector";
type AssertInputAssignable = InferredInput extends StringDataSelectorInput
  ? StringDataSelectorInput extends InferredInput
    ? true
    : "StringDataSelectorInput is wider than schema input"
  : "Schema input is wider than StringDataSelectorInput";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-time only
type AssertSync = [AssertOutputAssignable & true, AssertInputAssignable & true];

export const elementStyleSchema = z.record(z.string(), z.string());

export const markupEditSchema = z.readonly(
  z.object({
    selector: elementListSelectorSchema,
    style: elementStyleSchema,
  }),
);
/** @public */
export type MarkupEdit = z.infer<typeof markupEditSchema>;

export const markupEditsSchema = z.exactOptional(
  z.readonly(z.array(markupEditSchema)),
);
export type MarkupEdits = z.infer<typeof markupEditsSchema>;

const singleElementPlacementSchema = z.readonly(
  z.object({
    selector: elementSelectorSchema,
    position: placementPositionSchema,
    style: z.exactOptional(elementStyleSchema),
  }),
);
export type SingleElementPlacement = z.infer<
  typeof singleElementPlacementSchema
>;

export const elementPlacementSchema = allowMultiple(
  singleElementPlacementSchema,
);
export type ElementPlacementSchema = z.infer<typeof elementPlacementSchema>;
