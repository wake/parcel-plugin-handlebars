

/*
 *
 * Requires
 *
 */
const frontMatter = require ('front-matter');
const handlebars = require ('handlebars');
const handlebarsWax = require ('handlebars-wax');
const handlebarsLayouts = require ('handlebars-layouts');
const handlebarsHelpersPackage = require ('handlebars-helpers');
const HTMLAsset = require ('parcel-bundler/src/assets/HTMLAsset');
const handlebarsHelpers = handlebarsHelpersPackage ();


/*
 *
 * Configuratio
 *
 */
const defaultConfig = {
  data: 'src/markup/data',
  decorators: 'src/markup/decorators',
  helpers: 'src/markup/helpers',
  layouts: 'src/markup/layouts',
  partials: 'src/markup/partials',
};


/*
 *
 * HbsAsset
 *
 */
class HbsAsset extends HTMLAsset {


  /*
   *
   * Constructor
   *
   */
  constructor (name, pkg, options) {

    super (name, pkg, options);

    this.config = defaultConfig;
    this.hbs = {code: null, frontmatter: null};

    // Load config
    this.getConfig (['.hbsrc']).then (userConfig => {
      this.config = Object.assign ({}, defaultConfig, userConfig || {});
    });
  }


  /*
   *
   * Parse
   *
   */
  async parse (code) {

    // process any frontmatter yaml in the template file
    const frontmatter = frontMatter (code);

    // combine frontmatter data with NODE_ENV variable for use in the template
    const data = Object.assign ({}, frontmatter.attributes, { NODE_ENV: process.env.NODE_ENV });

    // initial handlebarsWax
    const wax = handlebarsWax (handlebars)
      .helpers (handlebarsLayouts)
      .helpers (handlebarsHelpers)
      .helpers (`${this.config.helpers}/**/*.js`)
      .data (`${this.config.data}/**/*.{json,js}`)
      .decorators (`${this.config.decorators}/**/*.js`)
      .partials (`${this.config.layouts}/**/*.{hbs,handlebars,js}`)
      .partials (`${this.config.partials}/**/*.{hbs,handlebars,js}`);

    // compile template into html markup and assign it to this.contents. super.generate () will use this variable.
    this.contents = wax.compile (frontmatter.body) (data);

    // Keep data
    this.hbs.code = code;
    this.hbs.frontmatter = frontmatter;

    // Return the compiled HTML
    return super.parse (this.contents);
  }


  /*
   *
   * Expend collector
   *
   */
  collectDependencies () {

    super.collectDependencies ();

    // Get dependencies from hbs template code
    this.collectHandlebarsTemplateDependencies ();
  }


  /*
   *
   * Collect dependencies from Handlebars template
   *
   */
  collectHandlebarsTemplateDependencies () {

    let template = this.hbs.frontmatter.body;

    //
    // `{{`                      - tag start
    // `(#extend|#embed|#>|>)`   - tag types
    // ` +`                      - space
    // `("[\w-]+"|[\w-]+)`       - tag name: `"name"` or `name`
    // `(?: .*?)?`               - space and other attributes
    // `}}`                      - tag end
    //
    let regex = /{{(#extend |#embed |#>|>) ?("[\w/-]+"|[\w/-]+)(?: .*?)?}}/i;

    (template.match (new RegExp (regex, 'gi')) || []).forEach (match => {

      let tag, name;

      // extract
      [, tag, name] = match.match (regex);

      // clear "
      tag = tag.trim ();
      name = name.replace (/["']/g, '');

      switch (tag) {

        // Layout
        case '#extend':
        case '>':
          this.addDependency (`${this.config.layouts}/${name}.hbs`, {includedInParent: true});
          break;

        // Partial
        case '#embed':
        case '#>':
          this.addDependency (`${this.config.partials}/${name}.hbs`, {includedInParent: true});
          break;
      }
    });
  }
}


module.exports = HbsAsset;
