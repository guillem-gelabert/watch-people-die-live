/** @type {import('stylelint').Config} */
const config = {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["node_modules/**", ".next/**", "public/**"],
};

export default config;
