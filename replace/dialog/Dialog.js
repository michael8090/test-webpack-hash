import { h } from '../vdom';

import './Dialog.scss';

const noop = () => {};

export default function Dialog({title = '', classNames = '', onCloseButtonClick = noop, onOpen = noop, onClose = noop}, children) {
    return (
        <div
          classNames={`dialog ${classNames}`}
          hook-init={vnode => onOpen(vnode)}
          hook-destroy={vnode => onClose(vnode)}
        >
            <div classNames="mask" />
            <div classNames="content">
                <div classNames="header">
                    {title}
                    <div classNames="close-button" on-click={onCloseButtonClick}>x</div>
                </div>
                <div classNames="body">
                    {children}
                </div>
            </div>
        </div>
    );
}
