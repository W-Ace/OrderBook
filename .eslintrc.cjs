module.exports = {
  root: true,
  env: {
    node: true,
    'vue/setup-compiler-macros': true,
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
    requireConfigFile: false,
    ecmaVersion: 2022,
  },
  globals: {
    defineEmits: 'readonly',
    defineProps: 'readonly',
    defineExpose: 'readonly',
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'plugin:vue/vue3-strongly-recommended',
    'airbnb-base',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error'],
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/type-annotation-spacing': 'error',
    '@typescript-eslint/space-infix-ops': 'error',
    'vue/require-explicit-emits': 'off',
    'space-infix-ops': 'off',
    'no-shadow': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'no-debugger': 'off',
    'no-plusplus': 'off',
    'no-param-reassign': 0,
    'linebreak-style': 0,
    'vue/no-v-html': 0,
    'consistent-return': 0,
    'import/no-unresolved': 'off',
    'import/extensions': 0,
    'import/no-extraneous-dependencies': 0,
    'import/prefer-default-export': 0,
    'no-useless-escape': 0,
    'import/resolver': 0,
    'max-len': 'off',
    'no-underscore-dangle': 0,
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true,
    }],
    'vue/multi-word-component-names': 0,
    'template-curly-spacing': 'off',
    indent: ['error', 2, {
      ignoredNodes: ['TemplateLiteral'],
    }],
  },
};
