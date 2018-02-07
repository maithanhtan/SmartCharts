/* eslint-disable no-new, react/jsx-indent, react/no-danger, react/jsx-indent-props */
import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import { createElement } from './components/ui/utils';
import Chart from './components/Chart.jsx';

class BinaryChartiq {
    static addNewChart({ selector }) {
        const chart = new BinaryChartiq(selector);
        return chart;
    }

    static _initCqManager() {
        const cqManager = $$$('cq-ui-manager');
        if (!cqManager) {
            document.body.appendChild(createElement('<cq-ui-manager />'));
        }
    }

    constructor(selector) {
        BinaryChartiq._initCqManager();
        this.selector = selector;

        this._updateRender();
    }

    getChartEngine() {
        const context = $$$('cq-context', $$$(this.selector));
        return context.CIQ.UI.context.stx;
    }

    _updateRender(props) {
        ReactDOM.render(
            <Chart id={this.selector.slice(1, this.selector.length)} {...props} />,
            $$$(this.selector),
        );
    }
}

export default BinaryChartiq;
