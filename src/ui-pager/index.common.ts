import {
    AddChildFromBuilder,
    Builder,
    CSSType,
    CoercibleProperty,
    Color,
    ContainerView,
    CoreTypes,
    GridLayout,
    ItemsSource,
    KeyedTemplate,
    Label,
    Length,
    Observable,
    ObservableArray,
    PercentLength,
    Property,
    Template,
    Trace,
    Utils,
    View,
    ViewBase,
    addWeakEventListener,
    makeParser,
    makeValidator,
    removeWeakEventListener
} from '@nativescript/core';

export type Orientation = 'horizontal' | 'vertical';

export namespace knownTemplates {
    export const itemTemplate = 'itemTemplate';
}

export namespace knownMultiTemplates {
    export const itemTemplates = 'itemTemplates';
}

export namespace knownCollections {
    export const items = 'items';
}

export const pagerTraceCategory = 'ns-pager';

export function PagerLog(message: string): void {
    Trace.write(message, pagerTraceCategory);
}

export function PagerError(message: string): void {
    Trace.write(message, pagerTraceCategory, Trace.messageType.error);
}

export { ItemsSource };
export interface ItemEventData {
    eventName: string;
    object: any;
    index: number;
    view: View;
    android: any;
    ios: any;
}

const autoEffectiveItemHeight = 100;
const autoEffectiveItemWidth = 100;

export enum Transformer {
    SCALE = 'scale'
}

const booleanConverter = (v: any): boolean => String(v) === 'true';

let UNIQUE_VIEW_TYPE = 0;

@CSSType('Pager')
export abstract class PagerBase extends ContainerView implements AddChildFromBuilder {
    public items: any[] | ItemsSource;
    public selectedIndex: number;
    public itemTemplate: string | Template;
    public itemTemplates: string | KeyedTemplate[];
    public canGoRight = true;
    public canGoLeft = true;
    public spacing: CoreTypes.PercentLengthType;
    public peaking: CoreTypes.PercentLengthType;
    public perPage: number;
    public circularMode: boolean;
    public autoPlayDelay: number;
    public autoPlay: boolean;
    // This one works along with existing NS property change event system
    public static selectedIndexChangeEvent = 'selectedIndexChange';
    public static scrollEvent = 'scroll';
    public static swipeEvent = 'swipe';
    public static swipeStartEvent = 'swipeStart';
    public static swipeOverEvent = 'swipeOver';
    public static swipeEndEvent = 'swipeEnd';
    public static loadMoreItemsEvent = 'loadMoreItems';
    public static itemLoadingEvent = 'itemLoading';
    public static itemDisposingEvent = 'itemDisposing';
    public orientation: Orientation;
    public _effectiveItemHeight: number;
    public _effectiveItemWidth: number;
    public transformers: string;
    public loadMoreCount: number = 1;
    public _childrenViews: { view: PagerItem; type: number }[];
    abstract readonly _childrenCount: number;
    public disableSwipe: boolean = false;
    public static knownFunctions = ['itemTemplateSelector', 'itemIdGenerator']; // See component-builder.ts isKnownFunction

    protected mObservableArrayInstance: ObservableArray<any>;

    abstract refresh(): void;

    static mRegisteredTransformers = {};
    public static registerTransformer(key: string, transformer) {
        PagerBase.mRegisteredTransformers[key] = transformer;
    }

    public indicator: {
        setProgress(position: number, progress: number);
        setSelection(index: number, animated?: boolean);
        setCount(count: number);
        withoutAnimation(callback: Function);
        getCount(): number;
        getSelection(): number;
        setInteractiveAnimation(animated?: boolean);
    };
    setIndicator(indicator) {
        this.indicator = indicator;
    }

    disposeNativeView() {
        this._childrenViews = [];
        if (this.mObservableArrayInstance) {
            this.mObservableArrayInstance.off(ObservableArray.changeEvent, this._observableArrayHandler);
            this.mObservableArrayInstance = null;
        }
        super.disposeNativeView();
    }

    protected abstract _observableArrayHandler(arg): void;

    setObservableArrayInstance(value) {
        if (this.mObservableArrayInstance) {
            this.mObservableArrayInstance.off(ObservableArray.changeEvent, this._observableArrayHandler);
            this.mObservableArrayInstance = null;
        }
        if (value instanceof ObservableArray) {
            this.mObservableArrayInstance = value as any;
            this.mObservableArrayInstance.on(ObservableArray.changeEvent, this._observableArrayHandler);
        } else {
            this.refresh();
        }
        selectedIndexProperty.coerce(this);
    }

    getChildView(index: number): View {
        return this._childrenViews && this._childrenViews[index].view;
    }
    _removeView(view: ViewBase) {
        // inside the recyclerview we wrap the PagerItem in a StackLayout
        // so we need to call remove on that stacklayout
        super._removeView(view);
        if (view instanceof PagerItem && this._childrenViews) {
            const index = this._childrenViews.findIndex((s) => s.view === view);
            if (index !== -1) {
                // this._removeChildView(index);
                if (this.isLoaded && this._isAddedToNativeVisualTree) {
                    this.refresh();
                }
            }
        }
    }
    protected _removeChildView(index: number) {
        this._childrenViews.splice(index, 1);
    }
    protected _addChildView(view, type) {
        this._childrenViews.push({ view, type });
    }

    _addChildFromBuilder(name: string, value: any): void {
        if (value instanceof PagerItem && value.parent !== this) {
            if (!this._childrenViews) {
                this._childrenViews = [];
            }
            this._addChildView(value, UNIQUE_VIEW_TYPE++);
            if (this.isLoaded) {
                this.refresh();
            }
        }
    }

    private _itemTemplateSelector: (item: any, index: number, items: any) => string;
    private _itemTemplateSelectorBindable = new Label();
    public _defaultTemplate: KeyedTemplate = {
        key: 'default',
        createView: () => {
            if (this.itemTemplate) {
                return Builder.parse(this.itemTemplate, this);
            }
            return undefined;
        }
    };

    public _itemTemplatesInternal = new Array<KeyedTemplate>(this._defaultTemplate);

    private _itemIdGenerator: (item: any, index: number, items: any) => number = (_item: any, index: number) => index;

    get itemIdGenerator(): (item: any, index: number, items: any) => number {
        return this._itemIdGenerator;
    }

    set itemIdGenerator(generatorFn: (item: any, index: number, items: any) => number) {
        this._itemIdGenerator = generatorFn;
    }

    get itemTemplateSelector(): string | ((item: any, index: number, items: any) => string) {
        return this._itemTemplateSelector;
    }

    set itemTemplateSelector(value: string | ((item: any, index: number, items: any) => string)) {
        if (typeof value === 'string') {
            this._itemTemplateSelectorBindable.bind({
                sourceProperty: null,
                targetProperty: 'templateKey',
                expression: value
            });
            this._itemTemplateSelector = (item: any, index: number, items: any) => {
                item['$index'] = index;
                if (this._itemTemplateSelectorBindable.bindingContext === item) {
                    this._itemTemplateSelectorBindable.bindingContext = null;
                }
                this._itemTemplateSelectorBindable.bindingContext = item;
                return this._itemTemplateSelectorBindable.get('templateKey');
            };
        } else if (typeof value === 'function') {
            this._itemTemplateSelector = value;
        }
    }

    onItemViewLoaderChanged() {}
    _itemViewLoader: Function;

    get itemViewLoader() {
        return this._itemViewLoader;
    }
    set itemViewLoader(value) {
        if (this._itemViewLoader !== value) {
            this._itemViewLoader = value;
            this.onItemViewLoaderChanged();
        }
    }

    public _getItemTemplateKey(index: number): string {
        let templateKey = 'default';
        if (this.itemTemplateSelector) {
            const dataItem = this._getDataItem(index);
            templateKey = this._itemTemplateSelector(dataItem, index, this.items);
        }
        return templateKey;
    }
    public _getItemTemplate(index: number): KeyedTemplate {
        const templateKey = this._getItemTemplateKey(index);

        const length = this._itemTemplatesInternal.length;
        for (let i = 0; i < length; i++) {
            if (this._itemTemplatesInternal[i].key === templateKey) {
                return this._itemTemplatesInternal[i];
            }
        }

        // This is the default template
        return this._itemTemplatesInternal[0];
    }

    public _prepareItem(item: View, index: number) {
        if (this.items && item) {
            item.bindingContext = this._getDataItem(index);
        }
    }

    _getDataItem(index: number): any {
        const thisItems = this.items;
        if (thisItems) {
            return thisItems && (thisItems as ItemsSource).getItem ? (thisItems as ItemsSource).getItem(index) : thisItems[index];
        }
    }

    public _getDefaultItemContent(index: number): View {
        const lbl = new Label();
        lbl.bind({
            targetProperty: 'text',
            sourceProperty: '$value'
        });
        return lbl;
    }

    abstract get disableAnimation(): boolean;
    abstract set disableAnimation(value: boolean);

    public abstract itemTemplateUpdated(oldData, newData): void;

    public onLayout(left: number, top: number, right: number, bottom: number) {
        super.onLayout(left, top, right, bottom);
        this._effectiveItemWidth = this.getMeasuredWidth() - this.effectivePaddingLeft - this.effectivePaddingRight;
        this._effectiveItemHeight = this.getMeasuredHeight() - this.effectivePaddingTop - this.effectivePaddingBottom;
        if (global.isIOS && this.iosOverflowSafeAreaEnabled) {
            const safeArea = this.getSafeAreaInsets();
            this._effectiveItemHeight += safeArea.top + safeArea.bottom;
        }
    }

    public convertToSize(length): number {
        let size = 0;
        if (this.orientation === 'horizontal') {
            size = global.isIOS ? Utils.layout.getMeasureSpecSize((this as any)._currentWidthMeasureSpec) : this.getMeasuredWidth();
        } else {
            size = global.isIOS ? Utils.layout.getMeasureSpecSize((this as any)._currentHeightMeasureSpec) : this.getMeasuredHeight();
        }

        let converted = 0;
        if (length && length.unit === 'px') {
            converted = length.value;
        } else if (length && length.unit === 'dip') {
            converted = Utils.layout.toDevicePixels(length.value);
        } else if (length && length.unit === '%') {
            converted = size * length.value;
        } else if (typeof length === 'string') {
            if (length.indexOf('px') > -1) {
                converted = parseInt(length.replace('px', ''), 10);
            } else if (length.indexOf('dip') > -1) {
                converted = Utils.layout.toDevicePixels(parseInt(length.replace('dip', ''), 10));
            } else if (length.indexOf('%') > -1) {
                converted = size * (parseInt(length.replace('%', ''), 10) / 100);
            } else {
                converted = Utils.layout.toDevicePixels(parseInt(length, 10));
            }
        } else if (typeof length === 'number') {
            converted = Utils.layout.toDevicePixels(length);
        }

        if (isNaN(converted)) {
            return 0;
        }
        return converted;
    }

    abstract _onItemsChanged(oldValue: any, newValue: any): void;
}

export class PagerItem extends GridLayout {}

function onItemsChanged(pager: PagerBase, oldValue, newValue) {
    if (oldValue instanceof Observable) {
        removeWeakEventListener(oldValue, ObservableArray.changeEvent, pager.refresh, pager);
    }

    if (newValue instanceof Observable && !(newValue instanceof ObservableArray)) {
        addWeakEventListener(newValue, ObservableArray.changeEvent, pager.refresh, pager);
    }

    if (!(newValue instanceof Observable) || !(newValue instanceof ObservableArray)) {
        pager.refresh();
    }
    pager._onItemsChanged(oldValue, newValue);
}

function onItemTemplateChanged(pager: PagerBase, oldValue, newValue) {
    pager.itemTemplateUpdated(oldValue, newValue);
}

export const circularModeProperty = new Property<PagerBase, boolean>({
    name: 'circularMode',
    defaultValue: false,
    valueConverter: booleanConverter
});

circularModeProperty.register(PagerBase);

export const selectedIndexProperty = new CoercibleProperty<PagerBase, number>({
    name: 'selectedIndex',
    defaultValue: -1,
    // affectsLayout: global.isIOS,
    coerceValue: (target, value) => {
        const items = target._childrenCount;
        if (items) {
            const max = items - 1;
            if (value < 0) {
                value = 0;
            }
            if (value > max) {
                value = max;
            }
        } else {
            value = -1;
        }

        return value;
    },
    valueConverter: (v) => parseInt(v, 10)
});
selectedIndexProperty.register(PagerBase);

export const spacingProperty = new Property<PagerBase, CoreTypes.LengthType>({
    name: 'spacing',
    defaultValue: { value: 0, unit: 'dip' },
    affectsLayout: true
});

spacingProperty.register(PagerBase);

export const peakingProperty = new Property<PagerBase, CoreTypes.LengthType>({
    name: 'peaking',
    defaultValue: { value: 0, unit: 'dip' },
    affectsLayout: true
});

peakingProperty.register(PagerBase);

export const itemsProperty = new Property<PagerBase, any>({
    name: 'items',
    affectsLayout: true,
    valueChanged: onItemsChanged
});
itemsProperty.register(PagerBase);

export const itemTemplateProperty = new Property<PagerBase, string | Template>({
    name: 'itemTemplate',
    affectsLayout: true,
    valueChanged: (target) => {
        target.refresh();
    }
});
itemTemplateProperty.register(PagerBase);

export const itemTemplatesProperty = new Property<PagerBase, string | KeyedTemplate[]>({
    name: 'itemTemplates',
    affectsLayout: true,
    valueConverter: (value) => {
        if (typeof value === 'string') {
            return Builder.parseMultipleTemplates(value);
        }
        return value;
    }
});
itemTemplatesProperty.register(PagerBase);

export const canGoRightProperty = new Property<PagerBase, boolean>({
    name: 'canGoRight',
    defaultValue: false,
    valueConverter: booleanConverter
});
canGoRightProperty.register(PagerBase);

export const canGoLeftProperty = new Property<PagerBase, boolean>({
    name: 'canGoLeft',
    defaultValue: false,
    valueConverter: booleanConverter
});
canGoLeftProperty.register(PagerBase);

const converter = makeParser<Orientation>(makeValidator('horizontal', 'vertical'));

export const orientationProperty = new Property<PagerBase, Orientation>({
    name: 'orientation',
    defaultValue: 'horizontal',
    affectsLayout: true,
    valueChanged: (target: PagerBase, oldValue: Orientation, newValue: Orientation) => {
        target.refresh();
    },
    valueConverter: converter
});
orientationProperty.register(PagerBase);

export const disableSwipeProperty = new Property<PagerBase, boolean>({
    name: 'disableSwipe',
    defaultValue: false,
    valueConverter: booleanConverter
});

disableSwipeProperty.register(PagerBase);

export const perPageProperty = new Property<PagerBase, number>({
    name: 'perPage',
    defaultValue: 1,
    valueConverter: (value) => Number(value)
});

perPageProperty.register(PagerBase);

export const transformersProperty = new Property<PagerBase, string>({
    name: 'transformers'
});

transformersProperty.register(PagerBase);

export const showIndicatorProperty = new Property<PagerBase, boolean>({
    name: 'showIndicator',
    defaultValue: false,
    valueConverter: booleanConverter
});
showIndicatorProperty.register(PagerBase);

export const autoPlayProperty = new Property<PagerBase, boolean>({
    name: 'autoPlay',
    defaultValue: false,
    valueConverter: booleanConverter
});
autoPlayProperty.register(PagerBase);

export const autoplayDelayProperty = new Property<PagerBase, number>({
    name: 'autoPlayDelay',
    defaultValue: 3000
});
autoplayDelayProperty.register(PagerBase);
