// Project lint rules. CodeGym validates every form with Zod + React Hook Form,
// so the browser's built-in constraint validation must never kick in.

const NATIVE_VALIDATION_ATTRS = new Set([
  "required",
  "pattern",
  "min",
  "max",
  "minLength",
  "maxLength",
  "step",
]);
const VALIDATING_INPUT_TYPES = new Set(["email", "url", "number"]);
const FORM_CONTROLS = new Set(["input", "textarea", "select"]);

function elementName(node) {
  return node.name && node.name.type === "JSXIdentifier" ? node.name.name : null;
}

function attr(node, name) {
  return node.attributes.find((a) => a.type === "JSXAttribute" && a.name && a.name.name === name);
}

const formRequiresNoValidate = {
  meta: {
    type: "problem",
    docs: { description: "Every <form> must set noValidate (validation is done with Zod)." },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (elementName(node) !== "form") return;
        const noValidate = attr(node, "noValidate");
        const disabled =
          noValidate &&
          noValidate.value &&
          noValidate.value.type === "JSXExpressionContainer" &&
          noValidate.value.expression.type === "Literal" &&
          noValidate.value.expression.value === false;
        if (!noValidate || disabled) {
          context.report({
            node,
            message: "Add `noValidate` to <form>; validate with a Zod schema via React Hook Form.",
          });
        }
      },
    };
  },
};

const noNativeValidationAttrs = {
  meta: {
    type: "problem",
    docs: { description: "Disallow HTML constraint-validation attributes on form controls." },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = elementName(node);
        // Lower-case DOM controls plus our shadcn wrappers that forward props to them.
        if (!name || !(FORM_CONTROLS.has(name) || name === "Input" || name === "Textarea")) return;
        for (const a of node.attributes) {
          if (a.type !== "JSXAttribute" || !a.name) continue;
          const attrName = a.name.name;
          if (NATIVE_VALIDATION_ATTRS.has(attrName)) {
            context.report({
              node: a,
              message: `Native validation attribute \`${attrName}\` is not allowed; put the rule in the Zod schema.`,
            });
          }
          if (
            attrName === "type" &&
            a.value &&
            a.value.type === "Literal" &&
            VALIDATING_INPUT_TYPES.has(a.value.value)
          ) {
            context.report({
              node: a,
              message: `type="${a.value.value}" triggers browser validation; use type="text" with inputMode and a Zod schema.`,
            });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "codegym" },
  rules: {
    "form-requires-novalidate": formRequiresNoValidate,
    "no-native-validation-attrs": noNativeValidationAttrs,
  },
};
