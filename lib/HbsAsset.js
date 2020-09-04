

/*
 *
 * Requires
 *
 */
const globby = require ('globby');
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
  paths: {
    data: 'src/markup/data',
    decorators: 'src/markup/decorators',
    helpers: 'src/markup/helpers',
    layouts: 'src/markup/layouts',
    partials: 'src/markup/partials'
  },
  watch: [
    '*data',
    '*decorators',
    '*helpers',
  ],
  patterns: {
  }
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
  constructor (name, options) {

    super (name, options);

    this.options = options;
    this.cwd = this.options && this.options.env && this.options.env.INIT_CWD || '.';

    this.config = defaultConfig;
    this.hbs = {code: null, frontmatter: null};

    // Load config
    this.getConfig (['.hbsrc']).then (userConfig => {

      this.config = Object.assign ({}, defaultConfig, userConfig || {});

      // Pattern mode
      this.config.patterns = {
        "*helpers": `${this.config.paths.helpers}/**/*.js`,
        "*data": `${this.config.paths.data}/**/*.{json,js}`,
        "*decorators": `${this.config.paths.decorators}/**/*.js`,
        "*layouts": `${this.config.paths.layouts}/**/*.{hbs,handlebars,js}`,
        "*partials": `${this.config.paths.partials}/**/*.{hbs,handlebars,js}`
      };
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
      .helpers (this.config.patterns['*helpers'])
      .data (this.config.patterns['*data'])
      .decorators (this.config.patterns['*decorators'])
      .partials (this.config.patterns['*layouts'])
      .partials (this.config.patterns['*partials']);

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
  async collectDependencies () {

    // Collect need watch dependencies
    await this.collectNeedWatchDepencencies ();

    // Collect dependencies from hbs template code
    this.collectPartialDependencies ();

    super.collectDependencies ();
  }


  /*
   *
   * Collect dependencies from Handlebars template
   *
   */
  collectPartialDependencies () {

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
          this.addDependency (`${this.config.paths.layouts}/${name}.hbs`, {includedInParent: true});
          break;

        // Partial
        case '#embed':
        case '#>':
          this.addDependency (`${this.config.paths.partials}/${name}.hbs`, {includedInParent: true});
          break;
      }
    });
  }


  /*
   *
   * Collect
   *
   */
  async collectNeedWatchDepencencies () {

    //this.addDependency (`${this.config.paths.data}/states.json`, {includedInParent: true});

    let cwd = this.options && this.options.env && this.options.env.INIT_CWD || '.'
      , patterns = []
      ;

    (this.config.hmrWatch || []).forEach (tar => patterns.push (this.config.patterns[tar] || tar));

    if (patterns.length > 0) {

      const files = await globby (patterns);

      files.forEach (file => this.addDependency (`${file}`, {includedInParent: true}));
    }
  }
}


module.exports = HbsAsset;
