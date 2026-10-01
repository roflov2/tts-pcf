import eslintjs from "@eslint/js";
import microsoftPowerApps from "@microsoft/eslint-plugin-power-apps";
import pluginReact from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

export default [
  {
    ignores: ["**/generated", "out/**", "node_modules/**", "coverage/**", "dist/**", "Solution/**"],
  },
  eslintjs.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...typescriptEslint.configs.stylistic,
  pluginReact.configs.flat.recommended,
  {
    plugins: {
      "@microsoft/power-apps": microsoftPowerApps,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ComponentFramework: true,
      },
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    settings: {
      react: { version: "16.14" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@microsoft/power-apps/avoid-2011-api": "error",
      "@microsoft/power-apps/avoid-browser-specific-api": "error",
      "@microsoft/power-apps/avoid-crm2011-service-odata": "warn",
      "@microsoft/power-apps/avoid-crm2011-service-soap": "warn",
      "@microsoft/power-apps/avoid-dom-form": "warn",
      "@microsoft/power-apps/avoid-dom-form-event": "warn",
      "@microsoft/power-apps/avoid-isactivitytype": "warn",
      "@microsoft/power-apps/avoid-modals": "warn",
      "@microsoft/power-apps/avoid-unpub-api": "warn",
      "@microsoft/power-apps/avoid-window-top": "error",
      "@microsoft/power-apps/do-not-make-parent-assumption": "warn",
      "@microsoft/power-apps/use-async": "error",
      "@microsoft/power-apps/use-cached-webresource": "warn",
      "@microsoft/power-apps/use-client-context": "warn",
      "@microsoft/power-apps/use-navigation-api": "warn",
      "@microsoft/power-apps/use-offline": "warn",
      "@microsoft/power-apps/use-relative-uri": "warn",
      "@microsoft/power-apps/use-utility-dialogs": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["**/__tests__/**", "dev/**", "scripts/**"],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
    rules: { "@typescript-eslint/no-empty-function": "off" },
  },
];
