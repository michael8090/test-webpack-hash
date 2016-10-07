import debounce from 'lodash/debounce';

import { h, getRender } from '../vdom';
import http from '../httpClient';
import Dialog from '../dialog/Dialog';
import LoadingPlaceholder from '../loading-placeholder/LoadingPlaceholder';

import './replaceEditor.scss';

const noop = () => {};

const api = {
    getReplacements: groupId => http.get(`/vc/api/panoreplacepic/group/${groupId}`)
        .then(data => {
            const mockRoomName = 'mock_room_name';
            const cp = (data.PanoReplacements[0] && data.PanoReplacements[0].camerapos) || '';
            const pvs = cp.split(',').map(parseFloat);
            const position = {x: pvs[0], y: pvs[1]};
            return {
                roomDecoProject: [{
                    obsRenderPics: data.PanoReplacements.map(p => ({
                        ...p,
                        ...{roomName: mockRoomName, position, smallImg: p.smallImg || p.img}}
                    )),
                    roomName: mockRoomName,
                }],
                roomPositions: {
                    [mockRoomName]: {
                        [cp]: [],
                    },
                },
                sortPos: {
                    [cp]: 1,
                }
            };
        }),
    deletePicture: replaceId => http.delete(`/vc/api/panoreplacepic/${replaceId}`),
    getPics: planId => http.get(`/vc/api/unpanoreplacepic/${planId}`),
    search: (picId, keyword, start, resultCount) => http.get(`/vc/api/brandgood/search/pano/${picId}`, {q: keyword, start, num: resultCount}),
    save: (planId, data) => http.post(`/vc/api/panoreplacepic/${planId}`, data),
};

const STAGE = {
    SELECT_CAMERA: 0,
    EDIT_INFO: 1,
};

function getDefaultStore(initStore = {}) {
    return {
        pics: null,
        isDialogOpenned: true,
        stage: STAGE.SELECT_CAMERA, // 1: select-camera, 2: edit-info
        isOnEditMode: false,
        planId: '',
        groupId: '',
        ...initStore,

        selectedRoom: '全部',
        isSubmitted: false,
    };
}

const findIndex = (arr, test) => {
    let index = -1;
    arr.some((v, i) => {
        if (test(v)) {
            index = i;
            return true;
        }
        return false;
    });
    return index;
};

const find = (arr, test) => arr[findIndex(arr, test)];

// the other components are stateless and share model in the store
let store = null;

const getPicsByRoom = (roomName) => {
    const {pics: {roomDecoProject}} = store;
    if (roomName !== '全部') {
        return (find(roomDecoProject, v => v.roomName === roomName) || {}).obsRenderPics || [];
    }
    return roomDecoProject.reduce((pics, v) => pics.concat(v.obsRenderPics), []);
};

const getSelectedRoomPics = () => getPicsByRoom(store.selectedRoom);

const getSelectedPicInSelectedRoom = () => getSelectedRoomPics().filter(p => p.isSelected);

const getPicInSameRoomAndSameCameraPosition = pic => getPicsByRoom(pic.roomName)
        .filter(({position: {x, y}}) => x === pic.position.x && y === pic.position.y);

const getPicsForInfoEditor = () => getPicsByRoom('全部').filter(p => store.isOnEditMode || p.isSelected);

let update = noop;


// validators returns an error message or null
const validators = {
    isRequired: v => v ? null : 'required',
};

function validate(vs, name) {
    const itemToBeValidated = find(vs, v => v.name === name);
    if (!itemToBeValidated) {
        return;
    }
    const {validator, value} = itemToBeValidated;
    itemToBeValidated.error = validator(value());
}

function getGoodTypeLabel(r) {
    return `${[r.brandGoodCode, r.brandGoodName].filter(s => !!s).join('|')}`;
}

// generally we don't use state, but without it the code will be verbose

function initMeta(data) {
    data.meta = {
        isSearchShown: false,
        searchResults: [],
        validators: [
            {
                name: 'goodTypeLabel',
                value: () => getGoodTypeLabel(data) || '',
                validator: validators.isRequired,
                error: null,
            },
            {
                name: 'displayName',
                value: () => data.tag,
                validator: validators.isRequired,
                error: null,
            },
        ],
    };
    ['goodTypeLabel', 'displayName'].forEach((name) => validate(data.meta.validators, name));
}

const actions = {
    resetStore(initStore) {
        store = getDefaultStore(initStore);
        update();
    },

    closeDialog() {
        store.isDialogOpenned = false;
        update();
    },

    fetch() {
        const fetch = store.isOnEditMode ?
            () => api.getReplacements(store.groupId) :
            () => api.getPics(store.planId);
        return fetch()
            .then(pics => {
                store.pics = pics;
                getPicsByRoom('全部').forEach(initMeta);
                update();
            });
    },

    selectRoom(roomName) {
        store.selectedRoom = roomName;
        update();
    },

    selectPic(pic) {
        if (!!getSelectedPicInSelectedRoom().length && !pic.isHighlighted) {
            return;
        }

        if (!pic.isSelected) {
            pic.isSelected = true;
            getPicsByRoom('全部').forEach(p => p.isHighlighted = false);
            getPicInSameRoomAndSameCameraPosition(pic).forEach(p => p.isHighlighted = true);
        } else {
            pic.isSelected = false;
        }

        update();
    },

    setStage(stage) {
        store.stage = stage;
        store.isSubmitted = false;
        update();
    },

    nextStep() {
        getPicsForInfoEditor().forEach((p, i) => p.priority = i === 0 ? 1 : 0);
        store.stage = STAGE.EDIT_INFO;
        store.isSubmitted = false;
        update();
    },

    save() {
        store.isSubmitted = true;
        const pics = getPicsForInfoEditor();
        if (pics.some(p => p.meta.validators.some(i => i.error))) {
            update();
            alert('请填写正确的商品信息');
            return;
        }
        const payload = pics.map(p => {
            const pl = {
                obsPicId: p.obsPicId,
                camerapos: `${p.position.x},${p.position.y}`,
                obsBrandGoodId: p.obsBrandGoodId,
                tag: p.tag,
                priority: p.priority,
                obsReplaceId: p.obsReplaceId,
                obsGroupId: p.obsGroupId,
            };
            return pl;
        });
        api.save(store.planId, payload)
            .then(store.onDone)
            .then(() => {
                store.isDialogOpenned = false;
                update();
            });
    },
};

const SelectCamera = ({data}) => {
    const selectedRoomPics = getSelectedRoomPics();
    const sameRoomPicLength = getSelectedPicInSelectedRoom().length;
    const hasSelectedPic = !!sameRoomPicLength;
    const hasEnoughPic = sameRoomPicLength >= 2;
    let lastRoomName = selectedRoomPics[0] && selectedRoomPics[0].roomName;

    return (
        <div classNames="select-camera">
            <div classNames="select-camera-header">
                <label>
                    房间：
                    <div classNames="select-wrapper">
                        <select on-change={(e) => actions.selectRoom(e.target.value)}>
                            {['全部'].concat(Object.keys(data.pics.roomPositions).concat()).map(roomName =>
                                <option value={roomName}>{roomName}</option>
                            )}
                        </select>
                    </div>
                </label>
                <label classNames="hint">请选择<span>相同房间</span>和<span>相同相机</span>位的全景图来生成</label>
            </div>
            <div classNames="selected-room-pics">
                {selectedRoomPics.reduce((children, p, i) => {
                    if (p.roomName !== lastRoomName) {
                        children.push(
                            <hr />
                        );
                        lastRoomName = p.roomName;
                    }
                    children.push(
                        <div classNames="room-pic-wrapper" key={i}>
                            <div
                              class={{'room-pic': true, selected: p.isSelected, disabled: hasSelectedPic && !p.isHighlighted}}
                              on-click={() => actions.selectPic(p)}
                            >
                                <div classNames="pic-content">
                                    <img src={p.smallImg} />
                                    <div classNames="pic-mask" />
                                    <div classNames="pic-checkbox" />
                                </div>
                                <div classNames="pic-info">
                                    <div classNames="name">{p.roomName}</div>
                                    <div classNames="count">
                                        相机位
                                        {data.pics.sortPos[find(Object.keys(data.pics.sortPos), k => {
                                            const pvs = k.split(',').map(parseFloat);
                                            return pvs[0] === p.position.x && pvs[1] === p.position.y;
                                        })]}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                    return children;
                }, [])}
            </div>
            <div classNames="replace-editor-footer">
                <div
                  class={{button: true, 'button-right': true, 'button-blue': hasEnoughPic, 'button-disabled': !hasEnoughPic}}
                  on-click={() => hasEnoughPic && actions.nextStep()}
                >
                  下一步
                </div>
            </div>
        </div>
    );
};

let lastSearchRequest = null;
const search = debounce(function (data, keyword) {
    if (lastSearchRequest) {
        lastSearchRequest.cancel();
    }
    lastSearchRequest = api.search(data.obsPicId, keyword, 0, 10);
    lastSearchRequest.then(results => {
        lastSearchRequest = null;
        data.meta.isSearchShown = true;
        data.meta.searchResults = results.brandGoods;
        update();
    });
}, 200);

const picInfoEditorActions = {
    search: (data, keyword) => {
        validate(data.meta.validators, 'goodTypeLabel');
        search(data, keyword);
        update();
    },

    selectGood(data, g) {
        data.brandGoodCode = g.brandGoodCode;
        data.brandGoodName = g.brandGoodName;
        data.customTexture = g.customTexture;
        data.obsBrandGoodId = g.obsBrandGoodId;
        data.previewImg = g.previewImg;

        if (!data.tag) {
            data.tag = g.brandGoodName.substring(0, 12);
            validate(data.meta.validators, 'displayName');
        }

        validate(data.meta.validators, 'goodTypeLabel');
        data.meta.isSearchShown = false;
        update();
    },

    setDisplayName(data, value) {
        data.tag = value;
        validate(data.meta.validators, 'displayName');
        update();
    },

    setAsDefault(data) {
        if (data.priority === 1) {
            return;
        }
        getPicInSameRoomAndSameCameraPosition(data).forEach(p => p.priority = 0);
        data.priority = 1;
        update();
    },

    deSelect(data) {
        if (data.priority === 1) {
            window.alert('不可删除默认图');
            return;
        }

        if (window.confirm('是否取消选中该商品替换图')) {
            data.isSelected = false;
            update();
        }
    },

    delete(data) {
        if (data.priority === 1) {
            window.alert('不可删除默认图');
            return;
        }
        if (window.confirm('是否删除该商品替换图')) {
            api.deletePicture(data.obsReplaceId)
                .then(actions.fetch);
        }
    },

    hideSearchResult(data) {
        data.meta.isSearchShown = false;
        update();
    },
};

const PicInfoEditor = ({data, isSubmitted, isOnEditMode}) => {
    const {meta} = data;
    const hasError = meta && meta.validators.some(i => !!i.error);
    const isNotEnoughForDelete = getPicInSameRoomAndSameCameraPosition(data).filter(p => isOnEditMode || p.isSelected).length <= 2;
    return (
        <div
          hook-init={() => initMeta(data)}
          class={{'pic-info-editor': true, error: isSubmitted && hasError}}
        //   snabbdom bug: the following line will break the diff algorithm
        //   classNames={`pic-info-editor ${isSubmitted && hasError ? 'error' : ''}`}
        >
            <a
              classNames="image"
              rel="noopener noreferrer"
              target="_blank"
              href={`/xiaoguotu/pano/${data.obsPicId}`}
            >
                <img src={data.smallImg} />
                {data.previewImg ?
                    <div classNames="thumb">
                        <img src={data.previewImg} />
                    </div> :
                    <noscript />
                }
            </a>
            <div classNames="inputs">
                <div class={{input: true, error: data.meta && find(data.meta.validators, v => v.name === 'goodTypeLabel').error}}>
                    <input
                      type="text"
                      placeholder="显示商品，请输商品名称或编号"
                      on-keyup={(e) => picInfoEditorActions.search(data, e.target.value)}
                      on-blur={() => picInfoEditorActions.hideSearchResult(data)}
                      value={getGoodTypeLabel(data) || ''}
                    />
                    {meta && meta.isSearchShown && data.meta.searchResults.length > 0 ?
                        <div classNames="search-results">
                            {data.meta.searchResults.map((r, i) => {
                                const label = getGoodTypeLabel(r);
                                if (!label) {
                                    return <noscript />;
                                }
                                return (
                                    <div classNames="search-result" key={i} on-mousedown={() => picInfoEditorActions.selectGood(data, r)} title={label}>
                                    {label}
                                    </div>
                                );
                            })}
                        </div> :
                        <noscript />
                    }
                </div>
                <div class={{input: true, error: data.meta && find(data.meta.validators, v => v.name === 'displayName').error}}>
                    <input type="text" placeholder="显示名称，至多12个字" maxLength="12" on-input={e => picInfoEditorActions.setDisplayName(data, e.target.value)} value={data.tag} />
                </div>
            </div>
            <div classNames="toolbox">
                <label classNames="set-as-default" on-click={() => picInfoEditorActions.setAsDefault(data)}>
                    <input type="radio" checked={data.priority === 1} />
                    设为默认图
                </label>
                <div class={{'icon-font': true, 'delete-button': true, 'button-disabled': isNotEnoughForDelete}} on-click={() => !isNotEnoughForDelete && (isOnEditMode ? picInfoEditorActions.delete : picInfoEditorActions.deSelect)(data)}>&#xe601;</div>
            </div>
        </div>
    );
};

const EditInfo = ({data}) => {
    return (
        <div classNames="edit-pic-info">
            <div classNames="pics">
                {getPicsForInfoEditor().map((p, i) =>
                    <PicInfoEditor isSubmitted={store.isSubmitted} data={p} key={i} isOnEditMode={data.isOnEditMode} />)
                }
            </div>
            <div classNames="replace-editor-footer">
                {!data.isOnEditMode ?
                    <div
                      classNames="button button-blue"
                      on-click={() => actions.setStage(STAGE.SELECT_CAMERA)}
                    >
                      上一步
                    </div> :
                    <noscript />
                }
                <div
                  classNames="button button-right button-blue"
                  on-click={actions.save}
                >
                  完成
                </div>
            </div>
        </div>
    );
};

const getStageComponent = (stage) => {
    return {
        [STAGE.SELECT_CAMERA]: SelectCamera,
        [STAGE.EDIT_INFO]: EditInfo,
    }[stage];
};

function alertServerErrorOut(e) {
    const reason = e.detail.reason;
    const msg = reason.response && reason.response.errorMsg;
    if (msg) {
        e.preventDefault();
        alert(msg);
    }
}

function onDialogOpen() {
    window.addEventListener('unhandledrejection', alertServerErrorOut);
    actions.fetch();
}

function onDialogClose() {
    window.removeEventListener('unhandledrejection', alertServerErrorOut);
    actions.resetStore();
}

const Editor = ({data}) => {
    if (!data.isDialogOpenned) {
        return <noscript />;
    }

    const Stage = getStageComponent(data.stage);
    return (
        <Dialog
          title="生成单空间商品替换图"
          classNames="replace-editor"
          onOpen={onDialogOpen}
          onClose={onDialogClose}
          onCloseButtonClick={actions.closeDialog}
        >
        {data.pics ?
            <Stage data={store} /> :
            <LoadingPlaceholder text="加载中" classNames={`${data.stage === STAGE.SELECT_CAMERA ? 'select-camera' : 'edit-pic-info'}`} />
        }
        </Dialog>
    );
};

let render = null;

update = () => render(<Editor data={store} />);

function setupAppOnce() {
    if (!render) {
        const mountPoint = document.createElement('div');
        mountPoint.id = `dialog-${Date.now()}`;
        document.body.appendChild(mountPoint);
        render = getRender(mountPoint);
        store = getDefaultStore();
    }
}

export function openSelectCameraDialog(planId, onDone = noop) {
    setupAppOnce();
    actions.resetStore({
        planId,

        // dirty hack
        onDone,
    });
}

export function openEditDialog(planId, groupId, onDone = noop) {
    setupAppOnce();
    actions.resetStore({
        planId,
        groupId,
        stage: STAGE.EDIT_INFO,
        isOnEditMode: true,

        // dirty hack
        onDone,
    });
}
