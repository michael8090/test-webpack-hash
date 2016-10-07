import {h} from '../vdom';

import './LoadingPlaceholder.scss';

export default function LoadingPlaceholder({text, classNames}) {
    return (
        <div classNames={`loading-placeholder ${classNames}`}>
            <div classNames="loading-label">{text}</div>
        </div>
    );
}
