import { ElementRef, TemplateRef, IterableDiffers, ViewContainerRef, AfterContentInit, DoCheck, OnDestroy, EventEmitter, EmbeddedViewRef } from '@angular/core';
import { View } from 'tns-core-modules/ui/core/view';
import { Pager } from '../';
export interface ComponentView {
    rootNodes: Array<any>;
    destroy(): void;
}
export declare type RootLocator = (nodes: Array<any>, nestLevel: number) => View;
export declare function getItemViewRoot(viewRef: ComponentView, rootLocator?: RootLocator): View;
export declare class PagerItemContext {
    $implicit: any;
    item: any;
    index: number;
    even: boolean;
    odd: boolean;
    constructor($implicit?: any, item?: any, index?: number, even?: boolean, odd?: boolean);
}
export interface SetupItemViewArgs {
    view: EmbeddedViewRef<any>;
    data: any;
    index: number;
    context: PagerItemContext;
}
export declare class PagerComponent implements DoCheck, OnDestroy, AfterContentInit {
    private _iterableDiffers;
    private viewInitialized;
    private _selectedIndex;
    private _items;
    private _differ;
    private pager;
    itemTemplate: TemplateRef<PagerItemContext>;
    private _templateMap;
    loader: ViewContainerRef;
    setupItemView: EventEmitter<SetupItemViewArgs>;
    itemTemplateQuery: TemplateRef<PagerItemContext>;
    constructor(el: ElementRef, _iterableDiffers: IterableDiffers);
    ngAfterContentInit(): void;
    readonly nativeElement: Pager;
    items: any;
    private setItemTemplates();
    registerTemplate(key: string, template: TemplateRef<PagerItemContext>): void;
    ngOnDestroy(): void;
    onItemLoading(args: any): void;
    setupViewRef(viewRef: EmbeddedViewRef<PagerItemContext>, data: any, index: number): void;
    private detectChangesOnChild(viewRef, index);
    ngDoCheck(): void;
}
export declare class TemplateKeyDirective {
    private templateRef;
    private pager;
    constructor(templateRef: TemplateRef<any>, pager: PagerComponent);
    pagerTemplateKey: any;
}
export declare class PagerModule {
}
