const {
    defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");

const {
    fixupConfigRules,
    fixupPluginRules,
} = require("@eslint/compat");

const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const jsxA11Y = require("eslint-plugin-jsx-a11y");
const prettier = require("eslint-plugin-prettier");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2021,
        sourceType: "module",

        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },

        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.jest,
        },
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:jsx-a11y/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "plugin:prettier/recommended",
        "prettier",
    )),

    plugins: {
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
        "jsx-a11y": fixupPluginRules(jsxA11Y),
        prettier: fixupPluginRules(prettier),
    },

    settings: {
        react: {
            version: "detect",
        },
        'import/resolver': {
          typescript: {
            // This tells ESLint to use tsconfig paths
            project: './tsconfig.json',
          },
          alias: {
            map: [['@site', '.']],
          },
          node: {
            extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.mdx'],
          },
        },
    },

    rules: {
        "prettier/prettier": "error",
        "react/prop-types": "off",
        "react/react-in-jsx-scope": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "import/no-unresolved": [
          "error",
          {
            ignore: ["^@theme/", "^@docusaurus/"]
          }
        ]
    },
}, {
    files: ["**/*.mdx", "**/*.md"],
    extends: compat.extends("plugin:mdx/recommended"),

    rules: {
        "react/jsx-no-undef": "off",
        "@typescript-eslint/no-unused-vars": "off",  // 👈 suppress false positives
    },
}, {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],

    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
}]);
