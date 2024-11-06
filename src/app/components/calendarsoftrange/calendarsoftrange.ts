import {
    booleanAttribute,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component, computed, ElementRef, forwardRef, Input,
    NgModule,
    OnInit, Signal,
    signal, ViewChild, ViewEncapsulation,
    WritableSignal
} from '@angular/core';
import {CommonModule} from "@angular/common";
import {SharedModule} from "../api/shared";
import {DropdownModule} from "../dropdown/dropdown";
import {PrimeNGConfig} from "../api/primengconfig";
import {SelectItem} from "../api/selectitem";
import {Nullable} from "../ts-helpers/ts-helpers";
import {ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR} from "@angular/forms";
import {DropdownChangeEvent} from "../dropdown/dropdown.interface";
import {Button, ButtonDirective} from "../button/button";
import {Ripple} from "../ripple/ripple";
import {ArrowLeftIcon} from "../icons/arrowleft/arrowleft";
import {AngleLeftIcon} from "../icons/angleleft/angleleft";
import {AngleRightIcon} from "../icons/angleright/angleright";
import {OverlayPanel, OverlayPanelModule} from "../overlaypanel/overlaypanel";
import {CalendarModule} from "../calendar/calendar";
import {DividerModule} from "../divider/divider";

export const CALENDAR_SOFT_RANGE_VALUE_ACCESSOR: any = {
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CalendarSoftRange),
    multi: true
};

/**
 * CalendarSoftRange displays a calendar for range selection more efficiently
 * @group Components
 */
@Component({
    selector: 'p-calendarSoftRange',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [CALENDAR_SOFT_RANGE_VALUE_ACCESSOR],
    host: {
        class: 'p-element p-inputwrapper',
    },
    encapsulation: ViewEncapsulation.None,
    styleUrls: ['./calendarsoftrange.css'],
    template: `
        <div [ngClass]="{'p-calendarsoftrange': true}" >
            <p-dropdown
                [options]="optionsRangeSelectItems()"
                (onChange)="onOptionRangeChange($event)"
                [ngModel]="optionRange()"
                (ngModelChange)="optionRange.set($event)"
            ></p-dropdown>
            <div [ngClass]="{'p-calendarsoftrange-date-container': true}">
                <button
                    type="button"
                    pButton
                    pRipple
                    [ngClass]="['p-calendarsoftrange-prev', prevButtonStyleClass]"
                    (click)="prevRange()"
                >
                    <AngleLeftIcon></AngleLeftIcon>
                </button>
                <button
                    #dateButton
                    type="button"
                    pButton
                    pRipple
                    [ngClass]="['p-calendarsoftrange-date', dateFormatedButtonStyleClass]"
                    (click)="openDatePanel($event)"
                >
                    {{valueFormatted()}}
                </button>
                <button
                    type="button"
                    pButton
                    pRipple
                    [ngClass]="['p-calendarsoftrange-next', nextButtonStyleClass]"
                    (click)="nextRange()"
                >
                    <AngleRightIcon></AngleRightIcon>
                </button>
            </div>
        </div>

        <p-overlayPanel #overlayPanel (onHide)="updateOptionRange()">
            <p-calendar
                selectionMode="range"
                [inline]="true"
                [selectOtherMonths]="true"
                [ngModel]="calendarValue()"
                (ngModelChange)="calendarValue.set($event)"/>

            <p-divider></p-divider>

            <div [ngClass]="{'p-calendarsoftrange-overlay-calendar': true}" >
                <button
                    type="button"
                    pButton
                    pRipple [ngClass]="['', cancelButtonStyleClass]"
                    (click)="overlayPanel.toggle($event)"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    pButton
                    pRipple [ngClass]="['', applyButtonStyleClass]"
                    (click)="applyDate()"
                >
                    Apply
                </button>
            </div>
        </p-overlayPanel>
    `
})
export class CalendarSoftRange implements OnInit, ControlValueAccessor{

    /**
     * When specified, disables the component.
     * @group Props
     */
    @Input({ transform: booleanAttribute }) disabled: boolean | undefined;

    /**
     * Specifies the types of ranges available for suggested selection. Does not affect the range the user can select in the calendar
     * @group Props
     */
    @Input() optionRangeType: OptionRangeType[] = ['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'PREV_WEEK', 'PREV_MONTH', 'THIS_YEAR'];

    /**
     * Style class of the prev button.
     * @group Props
     */
    @Input() prevButtonStyleClass: string = 'p-button-text';

    /**
     * Style class of the next button.
     * @group Props
     */
    @Input() nextButtonStyleClass: string = 'p-button-text';

    /**
     * Style class of the date formated button.
     * @group Props
     */
    @Input() dateFormatedButtonStyleClass: string = 'p-button-text p-button-plain';

    /**
     * Style class of the apply button.
     * @group Props
     */
    @Input() applyButtonStyleClass: string = '';

    /**
     * Style class of the cancel button.
     * @group Props
     */
    @Input() cancelButtonStyleClass: string = 'p-button-text';

    @ViewChild('overlayPanel') overlayPanel: OverlayPanel;
    @ViewChild('dateButton') dateButton: ElementRef;

    initialized: Nullable<boolean>;

    onModelChange: Function = () => {};

    onModelTouched: Function = () => {};

    readonly optionRange: WritableSignal<OptionRange> = signal(OptionRangeByType.TODAY);
    readonly calendarValue: WritableSignal<Date[]> = signal([]);
    readonly value: WritableSignal<Date[]> = signal([]);

    readonly valueFormatted: Signal<string> = computed(() => {
        return this.whenRangeIs(this.value(), {
            dayle: () => this.formatDate(this.value()[0]),
            monthly: () => this.formatMonth(this.value()[0]),
            yearly: () => this.formatYear(this.value()[0]),
            custom: () => `${this.formatDate(this.value()[0])} - ${this.formatDate(this.value()[1])}`
        });
    });

    readonly optionsRangeSelectItems: WritableSignal<SelectItem<OptionRange>[]> = signal([]);

    constructor(
        private config: PrimeNGConfig,
        public cd: ChangeDetectorRef
    ) {
        config.getTranslation('dateFormat');
    }

    ngOnInit() {
        this.initOptionsRange();
        this.initValue();
        this.initialized = true;
    }

    private initOptionsRange(): void{
        const optionRanges: SelectItem<OptionRange>[] = this.optionRangeType.map((type: OptionRangeType) => {
            return {
                label: this.config.translation[OptionRangeByType[type].translateKey],
                value: OptionRangeByType[type]
            };
        });

        optionRanges.push({
            label: this.config.translation[OptionRangeByType.CUSTOM.translateKey],
            value: OptionRangeByType.CUSTOM
        });

        this.optionsRangeSelectItems.set(optionRanges);
    }

    private initValue(): void{
        if(!this.value().length){
            const optionRange: OptionRange = this.optionsRangeSelectItems()[0]?.value ?? OptionRangeByType.TODAY;
            this.writeValue(optionRange.getRange());
        }
    }

    registerOnChange(fn: any): void {
        this.onModelChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onModelTouched = fn;
    }

    setDisabledState(val: boolean) {
        this.disabled = val;
        this.cd.markForCheck();
    }

    writeValue(value: any): void {
        if(value == null || value.length != 2){
            value = OptionRangeByType.TODAY.getRange();
        }

        const dates: Date[] = value;
        this.value.set([this.dateTruncateByDay(dates[0]), this.dateTruncateByDay(dates[1])]);
        this.updateOptionRange();
        this.cd.markForCheck();
    }

    updateOptionRange(): void{
        const optionRange: OptionRange = this.optionsRangeSelectItems()
            .map(item => item.value)
            .filter(optionRange => optionRange.type != 'CUSTOM')
            .find(optionRange => {
                const range: Date[] = optionRange.getRange();
                return this.dateTruncateByDay(range[0]).getTime() == this.value()[0].getTime() && this.dateTruncateByDay(range[1]).getTime() == this.value()[1].getTime();
            });

        this.optionRange.set(optionRange || OptionRangeByType.CUSTOM);
    }

    onOptionRangeChange(event: DropdownChangeEvent): void{
        const optionsRange: OptionRange = event.value;
        if(optionsRange.type == 'CUSTOM'){
            this.openDatePanel(event.originalEvent, this.dateButton.nativeElement);
            return;
        }

        this.writeValue(optionsRange.getRange());
    }

    isDaily(range: Date[]): boolean{
        const date_0: Date = this.dateTruncateByDay(range[0]);
        const date_1: Date = this.dateTruncateByDay(range[1]);

        return date_0.getTime() == date_1.getTime();
    }

    isMonthly(range: Date[]): boolean{
        const date_0: Date = this.dateTruncateByDay(range[0]);
        const date_1: Date = this.dateTruncateByDay(range[1]);

        const firstDayOfMonth: Date = new Date(date_0.getFullYear(), date_0.getMonth(), 1);
        const lastDayOfMonth: Date = new Date(date_1.getFullYear(), date_1.getMonth() + 1, 0);
        const sameYear: boolean = firstDayOfMonth.getFullYear() == lastDayOfMonth.getFullYear();
        const sameMonth: boolean = firstDayOfMonth.getMonth() == lastDayOfMonth.getMonth();

        return sameYear && sameMonth && firstDayOfMonth.getTime() == date_0.getTime() && lastDayOfMonth.getTime() == date_1.getTime();
    }

    isYearly(range: Date[]): boolean{
        const date_0: Date = this.dateTruncateByDay(range[0]);
        const date_1: Date = this.dateTruncateByDay(range[1]);

        const firstDayOfYear: Date = new Date(range[0].getFullYear(), 0, 1);
        const lastDayOfYear: Date = new Date(range[1].getFullYear(), 11, 31);
        const sameYear: boolean = firstDayOfYear.getFullYear() == lastDayOfYear.getFullYear();

        return sameYear && firstDayOfYear.getTime() == date_0.getTime() && lastDayOfYear.getTime() == date_1.getTime();
    }

    dateTruncateByDay(date: Date): Date{
        const data: Date = new Date(date);
        data.setHours(0, 0, 0, 0);
        return data;
    }

    getTranslation(option: string) {
        return this.config.getTranslation(option);
    }

    formatDate(date: Date): string{
        return date.toLocaleDateString();
    }

    formatMonth(date: Date): string{
        return `${this.getTranslation('monthNames')[date.getMonth()]} ${date.getFullYear()}`;
    }

    formatYear(date: Date): string{
        return date.getFullYear().toString();
    }

    prevRange(): void{
        this.whenRangeIs(this.value(), {
            dayle: () => {
                const date: Date = new Date(this.value()[0]);
                date.setDate(date.getDate() - 1);
                this.writeValue([date, date]);
            },
            monthly: () => {
                const date_0: Date = new Date(this.value()[0].getFullYear(), this.value()[0].getMonth() - 1, 1);
                const date_1: Date = new Date(this.value()[1].getFullYear(), this.value()[1].getMonth(), 0);

                this.writeValue([date_0, date_1]);
            },
            yearly: () => {
                const date_0: Date = new Date(this.value()[0]);
                date_0.setFullYear(date_0.getFullYear() - 1);

                const date_1: Date = new Date(this.value()[1]);
                date_1.setFullYear(date_1.getFullYear() - 1);

                this.writeValue([date_0, date_1]);
            },
            custom: () => {
                const intervalDays: number = this.getDiffDays(this.value()[0], this.value()[1]) + 1;

                const date_0: Date = new Date(this.value()[0]);
                date_0.setDate(date_0.getDate() - intervalDays);

                const date_1: Date = new Date(this.value()[1]);
                date_1.setDate(date_1.getDate() - intervalDays);

                this.writeValue([date_0, date_1]);
            }
        });
    }

    nextRange(): void{
        this.whenRangeIs(this.value(), {
            dayle: () => {
                const date: Date = new Date(this.value()[0]);
                date.setDate(date.getDate() + 1);
                this.writeValue([date, date]);
            },
            monthly: () => {
                const date_0: Date = new Date(this.value()[0].getFullYear(), this.value()[0].getMonth() + 1, 1);
                const date_1: Date = new Date(this.value()[1].getFullYear(), this.value()[1].getMonth() + 2, 0);

                this.writeValue([date_0, date_1]);
            },
            yearly: () => {
                const date_0: Date = new Date(this.value()[0]);
                date_0.setFullYear(date_0.getFullYear() + 1);

                const date_1: Date = new Date(this.value()[1]);
                date_1.setFullYear(date_1.getFullYear() + 1);

                this.writeValue([date_0, date_1]);
            },
            custom: () => {
                const intervalDays: number = this.getDiffDays(this.value()[0], this.value()[1]) + 1;

                const date_0: Date = new Date(this.value()[0]);
                date_0.setDate(date_0.getDate() + intervalDays);

                const date_1: Date = new Date(this.value()[1]);
                date_1.setDate(date_1.getDate() + intervalDays);

                this.writeValue([date_0, date_1]);
            }
        });
    }

    openDatePanel(event: Event, target?: any): void{
        this.calendarValue.set(this.value());
        this.overlayPanel.show(event, target);
    }

    applyDate(): void{
        const range: Date[] = this.calendarValue();
        range[1] = range[1] ?? range[0];

        this.writeValue(range);
        this.overlayPanel.hide();
    }

    private whenRangeIs(range: Date[], doWhen: {
        dayle: () => any,
        monthly: () => any,
        yearly: () => any,
        custom: () => any
    }): any{
        if(this.isDaily(range)){
            return doWhen.dayle();
        }else if(this.isMonthly(range)){
            return doWhen.monthly();
        }else if(this.isYearly(range)){
            return doWhen.yearly();
        }
        return doWhen.custom();
    }

    getDiffDays(date_1: Date, date_2: Date): number{
        const diffInMilliseconds: number = Math.abs(date_1.getTime() - date_2.getTime());
        const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
        return Math.floor(diffInMilliseconds / oneDayInMilliseconds)
    }
}

@NgModule({
    imports: [CommonModule, SharedModule, DropdownModule, FormsModule, ButtonDirective, Ripple, ArrowLeftIcon, AngleLeftIcon, AngleRightIcon, Button, OverlayPanelModule, CalendarModule, DividerModule],
    exports: [CalendarSoftRange, SharedModule],
    declarations: [CalendarSoftRange]
})
export class CalendarSoftRangeModule {}

type OptionRangeType = 'TODAY'|'THIS_WEEK'|'THIS_MONTH'|'PREV_WEEK'|'PREV_MONTH'|'THIS_YEAR'|'CUSTOM';

interface OptionRange {
    type: OptionRangeType;
    translateKey: string;
    getRange: () => Date[];
}

const OptionRangeByType:{[k in OptionRangeType]: OptionRange} = {
    TODAY: {
        type: 'TODAY',
        translateKey: 'today',
        getRange: () => {
            const today: Date = new Date();
            return [today, today];
        }
    },
    THIS_WEEK: {
        type: 'THIS_WEEK',
        translateKey: 'thisWeek',
        getRange: () => {
            const today: Date = new Date();
            const firstDay: Date = new Date(today.setDate(today.getDate() - today.getDay()));
            const lastDay: Date = new Date(firstDay);
            lastDay.setDate(firstDay.getDate() + 6);
            return [firstDay, lastDay];
        }
    },
    THIS_MONTH: {
        type: 'THIS_MONTH',
        translateKey: 'thisMonth',
        getRange: () => {
            const today: Date = new Date();
            const firstDay: Date = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay: Date = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return [firstDay, lastDay];
        }
    },
    PREV_WEEK: {
        type: 'PREV_WEEK',
        translateKey: 'prevWeek',
        getRange: () => {
            const today: Date = new Date();
            const firstDay: Date = new Date(today.setDate(today.getDate() - today.getDay() - 7));
            const lastDay: Date = new Date(firstDay);
            lastDay.setDate(firstDay.getDate() + 6);
            return [firstDay, lastDay];
        }
    },
    PREV_MONTH: {
        type: 'PREV_MONTH',
        translateKey: 'prevMonth',
        getRange: () => {
            const today: Date = new Date();
            const firstDay: Date = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDay: Date = new Date(today.getFullYear(), today.getMonth(), 0);
            return [firstDay, lastDay];
        }
    },
    THIS_YEAR: {
        type: 'THIS_YEAR',
        translateKey: 'thisYear',
        getRange: () => {
            const today: Date = new Date();
            const firstDay: Date = new Date(today.getFullYear(), 0, 1);
            const lastDay: Date = new Date(today.getFullYear(), 11, 31);
            return [firstDay, lastDay];
        }
    },
    CUSTOM: {
        type: 'CUSTOM',
        translateKey: 'custom',
        getRange: () => {
            const today: Date = new Date();
            return [today, today];
        }
    }
};
