import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'MEDS: a Health AI Ecosystem',
  tagline: 'Enabling reproducible modelling and analytics for health AI',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://medical-event-data-standard.github.io', // Website URL

  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Medical-Event-Data-Standard', // Usually your GitHub org/user name.
  projectName: 'medical-event-data-standard.github.io', // GitHub repo
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    () => ({
      name: 'custom-webpack-config',
      configureWebpack() {
        return {
          module: {
            rules: [
              {
                test: /\.ipynb$/, // Match all .ipynb files
                type: 'json', // Treat as JSON in Webpack 5+
              },
              {
                test: /\.ya?ml$/,
                use: 'yaml-loader',
              },
            ],
          },
          resolve: {
            extensions: ['.js', '.json', '.ipynb', '.yaml', '.yml'], // Allow importing .ipynb and YAML files
          },
        };
      },
    }),
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/tree/main/docs',
        },
        // blog: {
        //   showReadingTime: true,
        //   feedOptions: {
        //     type: ['rss', 'atom'],
        //     xslt: true,
        //   },
        //   // Please change this to your repo.
        //   // Remove this to remove the "edit this page" links.
        //   editUrl:
        //     'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        //   // Useful options to enforce blogging best practices
        //   onInlineTags: 'warn',
        //   onInlineAuthors: 'warn',
        //   onUntruncatedBlogPosts: 'warn',
        // },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: false,
      disableSwitch: true,
    },
    navbar: {
      title: 'MEDS',
      logo: {
        alt: 'MEDS Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Get Started',
        },
        {
          type: 'docSidebar',
          sidebarId: 'medsDevSidebar',
          position: 'left',
          label: 'MEDS-DEV',
        },
        //{to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/Medical-Event-Data-Standard',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorials',
              to: '/docs/intro_pages/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/meds',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/Medical-Event-Data-Standard',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Schema',
              to: 'https://github.com/Medical-Event-Data-Standard',
            },
            {
              label: 'MEDS-DEV',
              href: 'https://github.com/mmcdermott/MEDS-DEV',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Medical Event Data Standard.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
