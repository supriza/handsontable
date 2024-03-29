import path from 'path';
import { fileURLToPath } from 'url';
import jsdoc2md from 'jsdoc-to-markdown';
import dmd from 'dmd';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const buildJsdocToMarkdownIntegrator = ({ source }) => {
  const parseJsdoc = (files) => {
    return jsdoc2md.getTemplateDataSync({
      files: source(files),
      'no-cache': true,
    });
  };

  const generateMarkdown = data => dmd(data, {
    noCache: true,
    partial: path.join(__dirname, 'dmd/partials/**/*.hbs'),
    template: '{{>hot-main~}}'
  });

  return {
    parseJsdoc,
    generateMarkdown
  };
};
