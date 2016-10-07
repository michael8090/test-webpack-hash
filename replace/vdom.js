import snabbdom from 'snabbdom';
import sClass from 'snabbdom/modules/class'; // makes it easy to toggle classes
import sProps from 'snabbdom/modules/props'; // for setting properties on DOM elements
import sStyle from 'snabbdom/modules/style'; // handles styling on elements with support for animations
import sEventHandlers from 'snabbdom/modules/eventlisteners'; // attaches event listeners
import { html as h } from 'snabbdom-jsx';

const patch = snabbdom.init([sClass, sProps, sStyle, sEventHandlers]);

const getRender = domElement => {
    let oldVTree = null;

    return (vtree) => {
        if (oldVTree) {
            patch(oldVTree, vtree);
        } else {
            patch(domElement, vtree);
        }
        oldVTree = vtree;
    };
};

export {
    getRender,
    h,
};
