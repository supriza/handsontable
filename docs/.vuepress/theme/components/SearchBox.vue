<template>
  <div class="search-box">
    <input
      ref="input"
      aria-label="Search"
      :value="query"
      :class="{ 'focused': focused }"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      @input="query = $event.target.value"
      @focus="focused = true"
      @blur="focused = false"
      @keyup.enter="go(focusIndex)"
      @keyup.up="onUp"
      @keyup.down="onDown"
    >
    <span class="kbd-hint" title="press / or S to focus the search field">
      <kbd @click="focusInput()">/</kbd>
      <kbd @click="focusInput()">S</kbd>
    </span>
    <ul
      v-if="showSuggestions"
      class="suggestions"
      :class="{ 'align-right': alignRight }"
      @mouseleave="unfocus"
    >
      <template v-for="(s, i) in suggestions">
        <li v-if="s.category!==(suggestions[i-1] || {}).category"> {{ s.category }}: </li>
        <li
          :key="i"
          class="suggestion"
          :class="{ focused: i === focusIndex }"
          @mousedown="go(i)"
          @mouseenter="focus(i)"
        >
          <a
            :href="s.path"
            @click.prevent
          >
            <span class="page-title">{{ s.title || s.path }}</span>
            <span
              v-if="s.header"
              class="header"
            >&gt; {{ s.header.title }}</span>
          </a>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
/* global SEARCH_HOTKEYS */
import get from 'lodash/get';

const ALLOWED_TAGS = ['BODY', 'A', 'BUTTON'];

const priorityCompare = (a, b) => {
  if (a.priority > b.priority) {
    return -1;

  } else if (a.priority < b.priority) {
    return 1;
  }

  return 0;
};

const matchTest = (query, domain, isFuzzySearch = false) => {
  const escapeRegExp = str => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

  // eslint-disable-next-line no-control-regex
  const nonASCIIRegExp = /[^\x00-\x7F]/;

  const words = query
    .split(/\s+/g)
    .map(str => str.trim())
    .filter(str => !!str);

  if (isFuzzySearch || nonASCIIRegExp.test(query)) {
    return words.some(word => domain.toLowerCase().indexOf(word) > -1);
  } else {
    // if the query only has ASCII chars, treat as English
    const hasTrailingSpace = query.endsWith(' ');
    const searchRegex = new RegExp(
      `${words
        .map((word, index) => {
          if (words.length === index + 1 && !hasTrailingSpace) {
            // The last word - ok with the word being "startswith"-like
            return `(?=.*\\b${escapeRegExp(word)})`;
          } else {
            // Not the last word - expect the whole word exactly
            return `(?=.*\\b${escapeRegExp(word)}\\b)`;
          }
        })
        .join('')}.+`,
      'gi'
    );

    return searchRegex.test(domain);
  }
};

const matchQuery = (query, page, additionalStr = null, fuzzySearchDomains = []) => {
  let domain = get(page, 'title', '');

  if (get(page, 'frontmatter.tags')) {
    domain += ` ${page.frontmatter.tags.join(' ')}`;
  }

  if (additionalStr) {
    domain += ` ${additionalStr}`;
  }

  const isFuzzySearch = fuzzySearchDomains.includes(get(page, 'title', ''));

  return matchTest(query, domain, isFuzzySearch);
};

export default {
  name: 'SearchBox',

  data() {
    return {
      query: '',
      focused: false,
      focusIndex: 0,
      placeholder: undefined,
    };
  },

  computed: {
    showSuggestions() {
      return (
        this.focused
        && this.suggestions
        && this.suggestions.length
      );
    },

    suggestions() {
      const query = this.query.trim().toLowerCase();

      if (!query) {
        return;
      }

      const { pages } = this.$site;

      const {
        fuzzySearchDomains = [],
        categoryPriorityList = [],
      } = this.$site.themeConfig.searchOptions;

      const isSearchable = (page) => {
        // filter out results that do not match current locale
        if (this.getPageLocalePath(page) !== this.$localePath) {
          return false;
        }

        // filter out results that do not match searchable paths
        return this.isSearchable(page);
      };

      const getShortPageTitle = ({ title }) => {
        return title === 'Configuration options' ? 'Options' : title;
      };

      const duplicatePagesGuard = [];
      const searchResults = new Map(categoryPriorityList.map(({ name, domainPriority }) => {
        const priorityList = [...domainPriority].reverse();
        const categorySearchResults = [];

        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const searchCategory = p.frontmatter.searchCategory;

          if (!isSearchable(p) || searchCategory && searchCategory !== name) {
            continue; // eslint-disable-line
          }

          const priority = priorityList.indexOf(get(p, 'title', ''));

          if (matchQuery(query, p, null, fuzzySearchDomains)) {
            categorySearchResults.push({
              ...p,
              title: getShortPageTitle(p),
              category: name,
              priority: priority + 1,
            });
          }

          if (p.headers) {
            for (let j = 0; j < p.headers.length; j++) {
              const h = p.headers[j];
              const path = `${p.path}#${h.slug}`;

              if (h.title && matchQuery(query, p, h.title, fuzzySearchDomains) &&
                  !duplicatePagesGuard.includes(path)) {
                duplicatePagesGuard.push(path);
                categorySearchResults.push({
                  ...p,
                  title: getShortPageTitle(p),
                  path,
                  header: h,
                  category: name,
                  priority,
                });
              }
            }
          }
        }

        return [name, categorySearchResults.sort(priorityCompare)];
      }));

      const res = categoryPriorityList.reduce((results, { name, maxSuggestions }) => {
        return results.concat(searchResults.get(name).splice(0, maxSuggestions));
      }, []);

      return res;
    },

    // make suggestions align right when there are not enough items
    alignRight() {
      const navCount = (this.$site.themeConfig.nav || []).length;
      const repo = this.$site.repo ? 1 : 0;

      return navCount + repo <= 2;
    }
  },

  mounted() {
    this.placeholder = this.$site.themeConfig.searchOptions.placeholder || '';
    document.addEventListener('keydown', this.onHotkey);
  },

  beforeDestroy() {
    document.removeEventListener('keydown', this.onHotkey);
  },

  methods: {
    getPageLocalePath(page) {
      // eslint-disable-next-line no-restricted-syntax
      for (const localePath in Object.keys(this.$site.locales || {})) {
        if (localePath !== '/' && page.path.indexOf(localePath) === 0) {
          return localePath;
        }
      }

      return '/';
    },

    isSearchable(page) {
      return this.$page.currentFramework === page.currentFramework;
    },

    onHotkey(event) {
      const isValidElement = ALLOWED_TAGS.includes(event.srcElement.tagName)
        || event.srcElement.id === 'slider'; // theme switcher;

      if (isValidElement && SEARCH_HOTKEYS.includes(event.key)) {
        this.$refs.input.focus();
        event.preventDefault();
      }
    },

    onUp() {
      if (this.showSuggestions) {
        if (this.focusIndex > 0) {
          this.focusIndex -= 1;
        } else {
          this.focusIndex = this.suggestions.length - 1;
        }
      }
    },

    onDown() {
      if (this.showSuggestions) {
        if (this.focusIndex < this.suggestions.length - 1) {
          this.focusIndex += 1;
        } else {
          this.focusIndex = 0;
        }
      }
    },

    go(i) {
      if (!this.showSuggestions) {
        return;
      }

      if (this.$route.fullPath !== this.suggestions[i].path) {
        this.$router.push(this.suggestions[i].path);
      }

      this.query = '';
      this.focusIndex = 0;
    },

    focus(i) {
      this.focusIndex = i;
    },

    unfocus() {
      this.focusIndex = -1;
    },

    focusInput() {
      this.$refs.input.focus();
    }
  }
};
</script>

<style lang="stylus">
.search-box.search-box
  display inline-block
  position relative
  margin-right 1.5rem
  input
    cursor text
    width 11rem
    height: 2rem
    display inline-block
    border 1px solid #cfdbe4
    border-radius 6px
    font-size 14px
    line-height 2rem
    padding 0 0.5rem 0 2.2rem
    outline none
    /* Fallback for IE, should work in production */
    background #fff url('{{$basePath}}/img/search.svg') 0.6rem 0.5rem no-repeat
    background-size 1rem
    &:focus
      color $textColor
      cursor auto
      border-color $accentColor
      + .kbd-hint
          opacity 0
  .kbd-hint
    position relative
    left -57px
    top -13px
    cursor pointer
    transition all 0.2s linear
    kbd
      position absolute
      line-height 1
      box-sizing border-box
      padding: 0.1em 0.25em;
      &:first-child
        left 24px
  .suggestions
    background #fff
    max-width calc(100vw - 4rem)
    width 22rem
    position absolute
    top 1.6rem
    border 1px solid $borderColor
    border-radius 6px
    padding 0.4rem
    list-style-type none
    &.align-right
      right 0
    li:not(.suggestion) {
      padding 0.4rem 0.6rem
      margin-bottom 0.4rem
      font-weight 600
      font-size 13px
      border-bottom 1px solid #e9eef2
    }
  .suggestion
    line-height 1.4
    padding 0.4rem 0.6rem
    border-radius 6px
    cursor pointer
    a
      white-space normal
      color lighten($textColor, 25%)
      font-weight 500
      .page-title

      .header
        font-size 0.9em
        margin-left 0.25em
    &.focused
      background-color #f3f4f9
      a
        color $accentColor

@media (max-width: $extraLarge)
  .search-box.search-box
    margin-right 0
    input
      cursor pointer
      width 0
      background-color transparent
      border-color transparent
      position absolute
      right 10px
      z-index 20
      font-size 14px
      &:focus
        cursor text
        left auto
        width 7rem
        // The browser will zoom if the font-size is less than 16px so this is to prevent that.
        font-size: 16px;
        background-color #fff
    .kbd-hint *
      display none

@media (max-width: $medium)
  input
    right 0!important
</style>
