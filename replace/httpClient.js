import Promise from 'bluebird';

class HttpClientError extends Error {
    constructor(message, {code, response} = {}) {
        // bluebird checks if the message is string to determin if it's of an Error type
        message = JSON.stringify(message);
        super(message);
        this.message = message;
        this.name = 'HttpClientError';
        this.response = response;
        this.code = code;
        Error.captureStackTrace(this, HttpClientError);
    }
}

// retain a reference of the returned promise to call cancel on it
// as then/catch returns a new promsise, which has no `cacel` method

function makeCancellable(promise) {
    let isCancelled = false;

    const wrappedPromise = new Promise((resolve) => {
        promise.then(result => {
            if (!isCancelled) {
                resolve(result);
            }
        }).catch(e => {
            throw e;
        });
    }).catch(e => {
        if (!isCancelled) {
            throw e;
        }
    });

    wrappedPromise.cancel = () => isCancelled = true;

    return wrappedPromise;
}

function request(type, {url = '', payload, query = {}}) {
    const hasQueryString = url.indexOf('?') !== -1;
    const appendantString = Object.keys(query).reduce((str, key, i) => {
        if (i !== 0) {
            str += '&';
        }
        str += `${key}=${query[key]}`;
        return str;
    }, '');

    if (appendantString !== '') {
        url = hasQueryString ? url + '&' + appendantString : url + '?' + appendantString;
    }

    return makeCancellable(new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(type, url);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        // xhr.setRequestHeader('Accept', 'application/json');
        xhr.withCredentials = true;
        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                if (typeof response.errorCode === 'undefined' || response.errorCode === 0) {
                    resolve(response);
                } else {
                    reject(new HttpClientError(response.errorMsg || response.errorCode, {response}));
                }
            } else {
                reject(new HttpClientError(xhr.status, {code: xhr.status}));
            }
        };
        xhr.onerror = reject;
        const sendPayload = typeof payload === 'undefined' ? undefined : JSON.stringify(payload);
        xhr.send(sendPayload);
    }));
}

export default {
    get: (url, query) => request('get', {url, query}),
    post: (url, payload, query) => request('post', {url, payload, query}),
    put: (url, payload, query) => request('put', {url, payload, query}),
    delete: (url, payload, query) => request('delete', {url, payload, query}),
};
