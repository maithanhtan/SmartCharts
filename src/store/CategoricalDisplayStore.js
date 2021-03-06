import PerfectScrollbar from 'perfect-scrollbar';
import { action, observable, computed, when, reaction, toJS } from 'mobx';
import { connect } from './Connect';

export default class CategoricalDisplayStore {
    constructor({
        getCategoricalItems,
        onSelectItem,
        getIsShown,
        getActiveCategory,
        activeOptions,
        placeholderText,
        favoritesId,
        mainStore,
    }) {
        reaction(getIsShown, () => {
            if (getIsShown()) {
                // Odd. Why is setTimeout needed here?
                if (!this.isMobile) {
                    setTimeout(() => this.searchInput.focus(), 0);
                }
                if (!this.isInit) { this.init(); }
                setTimeout(() => {
                    this.updateScrollOffset();
                }, 0);
            }
        });
        this.getCategoricalItems = getCategoricalItems;
        this.onSelectItem = onSelectItem;
        this.getActiveCategory = getActiveCategory;
        this.activeOptions = activeOptions;
        this.placeholderText = placeholderText;
        this.favoritesId = favoritesId;
        this.categoryElements = {};
        this.mainStore = mainStore;
        this.isInit = false;
        reaction(
            () => this.mainStore.favoriteSessionStore.favoritesChangeTrigger,
            () => { this.updateFavorites(); },
        );

        if (favoritesId && mainStore) {
            when(() => this.context, this.initFavorites.bind(this));
        }
    }
    @observable filterText = '';
    @observable placeholderText = '';
    @observable activeCategoryKey = '';
    @observable favoritesMap = {};
    @observable favoritesCategory = {
        categoryName: t.translate('Favorites'),
        categoryId: 'favorite',
        hasSubcategory: false,
        emptyDescription: t.translate('There are no favorites yet.'),
        data: [],
    };
    scrollOffset = 0;

    get context() {
        return this.mainStore.chart.context;
    }

    initFavorites() {
        const layout = this.context.stx.layout;
        if (!layout.favorites) { layout.favorites = {}; }
        if (!layout.favorites[this.favoritesId]) { layout.favorites[this.favoritesId] = []; }

        this.favoritesCategory.data = layout.favorites[this.favoritesId];
        for (const fav of this.favoritesCategory.data) {
            if (fav) {
                this.favoritesMap[(typeof fav === 'string' ? fav : fav.itemId)] = true;
            }
        }
    }

    updateFavorites() {
        this.favoritesMap = {};
        this.initFavorites();
    }

    updateScrollOffset() {
        this.scrollOffset = this.scrollPanel.getBoundingClientRect().top;
    }

    updateScrollSpy() {
        if (this.pauseScrollSpy) { return; }
        if (this.filteredItems.length === 0) { return; }

        let i = 0;
        for (const category of this.filteredItems) {
            const el = this.categoryElements[category.categoryId];
            if (!el) {
                i++;
                continue;
            }
            const r = el.getBoundingClientRect();
            const top = r.top - this.scrollOffset;
            if (top > 0) { break; }
            i++;
        }
        // get first non-empty category
        let idx = i - 1;
        let id;
        while (idx >= 0) {
            id = this.filteredItems[idx].categoryId;
            if (this.categoryElements[id] !== null) {
                break;
            }
            idx--;
        }
        this.activeCategoryKey = id || this.filteredItems[0].categoryId;
    }

    init() {
        this.isInit = true;
        this.scroll = new PerfectScrollbar(this.scrollPanel);

        this.scrollPanel.addEventListener('ps-scroll-y', this.updateScrollSpy.bind(this));

        // Select first non-empty category:
        if (this.activeCategoryKey === '' && this.filteredItems.length > 0) {
            for (const category of this.filteredItems) {
                const el = this.categoryElements[category.categoryId];
                if (el) {
                    this.activeCategoryKey = category.categoryId;
                    break;
                }
            }
        }
    }

    /* isMobile: fill form the ChartStore */
    @computed get isMobile() {
        if (this.mainStore) {
            return this.mainStore.chart.isMobile;
        }
        return false;
    }


    @computed get filteredItems() {
        const filteredItems = toJS(this.getCategoricalItems());

        if (this.favoritesId) {
            const favsCategory = toJS(this.favoritesCategory);
            const findFavItem = (category) => {
                const foundItems = [];
                if (category.hasSubcategory) {
                    category.data.forEach((subcategory) => {
                        const foundSubItems = findFavItem(subcategory);
                        foundItems.push(...foundSubItems);
                    });
                } else {
                    favsCategory.data.forEach((favItem) => {
                        if (typeof favItem === 'string') {
                            const itemObj = category.data.find(item => item.itemId === favItem);
                            if (itemObj) {
                                foundItems.push(itemObj);
                            }
                        }
                    });
                }
                return foundItems;
            };

            const favsCategoryItem = favsCategory.data
                .filter(favItem => (typeof favItem !== 'string'));

            filteredItems.forEach((category) => {
                const foundItems = findFavItem(category);
                favsCategoryItem.push(...foundItems);
            });

            favsCategory.data = favsCategoryItem.filter(favItem => favItem);
            filteredItems.unshift(favsCategory);
        }

        if (this.getActiveCategory) {
            const activeCategory = toJS(this.getActiveCategory());
            filteredItems.unshift(activeCategory);
        }

        if (this.filterText === '') {
            return filteredItems;
        }

        const reg = RegExp(this.filterText, 'i');
        const filterCategory = (c) => {
            c.data = c.data.filter(item => reg.test(item.display));
        };

        for (const category of filteredItems) {
            if (category.hasSubcategory) {
                for (const subcategory of category.data) {
                    filterCategory(subcategory);
                }
            } else {
                filterCategory(category);
            }
        }

        return filteredItems;
    }

    @action.bound setCategoryElement(element, id) {
        this.categoryElements[id] = element;
    }

    @action.bound setFilterText(filterText) {
        this.filterText = filterText;
        setTimeout(() => {
            this.scroll.update();
            this.updateScrollSpy();
        }, 0);
    }

    @action.bound clearFilterText() {
        this.setFilterText('');
        this.searchInput.value = '';
    }

    @action.bound handleFilterClick(category) {
        const el = this.categoryElements[category.categoryId];

        if (el) {
            // TODO: Scroll animation
            this.pauseScrollSpy = true;
            this.scroll.element.scrollTop = el.offsetTop;
            this.activeCategoryKey = category.categoryId;
            // scrollTop takes some time to take affect, so we need
            // a slight delay before enabling the scroll spy again
            setTimeout(() => { this.pauseScrollSpy = false; }, 3);
        }
    }

    @action.bound setSearchInput(element) {
        this.searchInput = element;
    }

    @action.bound setScrollPanel(element) {
        this.scrollPanel = element;
    }

    @action.bound getItemCount(category) {
        let count = 0;
        if (category.hasSubcategory) {
            for (const sub of category.data) {
                count += sub.data.length;
            }
        } else {
            count += category.data.length;
        }

        return count;
    }

    @action.bound onFavoritedItem(item, e) {
        e.stopPropagation();
        e.nativeEvent.isHandledByDialog = true; // prevent close dialog
        this.setFavorite(item);
    }
    setFavorite(item) {
        if (this.favoritesMap[item.itemId]) {
            this.favoritesCategory.data = this.favoritesCategory.data
                .filter(favItem => favItem && favItem.itemId !== item.itemId && favItem !== item.itemId);

            delete this.favoritesMap[item.itemId];
        } else {
            this.favoritesCategory.data.push(item);
            this.favoritesMap[item.itemId] = true;
        }

        const layout = this.context.stx.layout;
        layout.favorites[this.favoritesId] = toJS(this.favoritesCategory.data)
            .filter(favItem => favItem)
            .map(favItem => (typeof favItem === 'string' ? favItem : favItem.itemId));
        this.mainStore.favoriteSessionStore.favoritesChangeTrigger = !this.mainStore.favoriteSessionStore.favoritesChangeTrigger;
        this.mainStore.chart.saveLayout();
    }

    setFavoriteById(id) {
        let foundItem = null;
        for (const category of this.getCategoricalItems()) {
            for (const item of category.data) {
                if (item.itemId === id) {
                    foundItem = item;
                    break;
                }
            }
            if (foundItem) { break; }
        }
        if (foundItem) {
            this.setFavorite(foundItem);
        }
    }

    connect = connect(() => ({
        isMobile: this.isMobile,
        filterText: this.filterText,
        setFilterText: this.setFilterText,
        clearFilterText: this.clearFilterText,
        filteredItems: this.filteredItems,
        getItemCount: this.getItemCount,
        setSearchInput: this.setSearchInput,
        handleFilterClick: this.handleFilterClick,
        onSelectItem: this.onSelectItem,
        hasActiveItems: (this.getActiveCategory !== undefined),
        activeOptions: this.activeOptions,
        placeholderText: this.placeholderText,
        activeCategoryKey: this.activeCategoryKey,
        setScrollPanel: this.setScrollPanel,
        setCategoryElement: this.setCategoryElement,
        onFavoritedItem: this.onFavoritedItem,
        favoritesMap: this.favoritesMap,
        favoritesId: this.favoritesId,
        CloseUpperMenu: this.CloseUpperMenu,
    }))
}
