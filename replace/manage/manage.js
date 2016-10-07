import { h, getRender } from '../vdom';

import api from './api';
import {openSelectCameraDialog, openEditDialog} from '../create-replace/replaceEditor';

import './manage.scss';

let update = null;

function deleteReplaceGroup(id) {
    if (window.confirm('确定要删除这组替换图吗？')) {
        api.deleteReplaceGroup(id)
            .then(update);
    }
}

const Picture = ({data, planId}) => {
    const tags = [];
    if (data.isSHD) {
        tags.push('高清');
    }
    return (
        <div classNames="picture">
            <div classNames="content">
                <img src={data.smallImg} />
                <div classNames="tags">
                    {tags.map((t, i) => (
                        <div classNames="tag" key={i}>{t}</div>
                    ))}
                </div>
                <div classNames="delete-button" on-click={() => deleteReplaceGroup(data.obsGroupId)} />
                <div classNames="toolbox">
                    <a classNames="tool-button" rel="noopener noreferrer" target="_blank" href={`/cloud/design/${planId}/group?obsgroupid=${data.obsGroupId}`}>查看</a>
                    <a classNames="tool-button" on-click={() => openEditDialog(planId, data.obsGroupId, update)}>编辑</a>
                </div>
            </div>
            <div classNames="info">
                <span classNames="name">{data.roomName}</span>
                <span classNames="time">{data.formatCreated}</span>
            </div>
        </div>
    );
};

const Hint = ({title = '', text = ''}, children) => (
    <div classNames="hint">
        <div classNames="hint-content">
            <div classNames="empty-icon" />
            <div classNames="hint-title">{title}</div>
            <div classNames="hint-text">{text}</div>
            <div classNames="hint-buttons">{children}</div>
        </div>
    </div>
);

const PictureGallery = ({data: {pics, canGenerate, planId, designId}}) => {
    let content = null;
    if (pics && pics.length > 0) {
        content = pics.map((p, i) => <Picture data={p} key={i} planId={planId} />);
    } else if (!canGenerate) {
        content = (
            <Hint
              title="没有能组成可替换全景图的单空间全景图，请前往DIY工具进行渲染"
              text="单空间全景图：若干张房间和渲染相机位相同的全景图"
            >
                <a href={`/vc/flash/diy?designid=${designId}&redirecturl=${encodeURIComponent(window.location.href)}`} classNames="button button-blue">前往DIY</a>
                <a href="http://www.kujiale.com/ask/3FO4K6TAWWYJ" classNames="button">查看功能说明</a>
            </Hint>
        );
    } else {
        content = (
            <Hint
              title="还没有生成单空间替换商品图"
              text="点击按钮来上传吧～"
            >
                <a on-click={() => openSelectCameraDialog(planId, update)} classNames="button button-blue">生成单空间商品替换图</a>
            </Hint>
        );
    }
    return (
        <div classNames="pic-gallery">
            {content}
        </div>
    );
};

const Header = ({data}) => (
    <div classNames="header">
        <div classNames="buttons">
        {data.pics.length > 0 ?
            <div
              class={{button: true, 'create-replacement': true, 'button-blue': data.hasSamePosPic, 'button-disabled': !data.hasSamePosPic}}
              on-click={() => data.hasSamePosPic && openSelectCameraDialog(data.floorplan.obsPlanId, update)}
            >
                生成单空间商品替换图
                {data.hasSamePosPic ?
                    <noscript /> :
                    <div classNames="tooltip">
                        你还没有用来生成的单元全景图，请去DIY工具生成，
                        <a href={`/vc/flash/diy?designid=${data.obsDesignId}&redirecturl=${encodeURIComponent(window.location.href)}`} classNames="blue">立即前往 ></a>
                    </div>
                }
            </div> :
            <noscript />
        }
        </div>
        <span classNames="design-name">{data.decoName}</span>
        <div classNames="info-tag">
            <label classNames="address">{data.floorplan.planCity}</label>
            <label classNames="type">{['小区房', '自建房', '工装房'][data.floorplan.planType] || ''}</label>
            <label classNames="type">{data.floorplan.specName}</label>
        </div>
    </div>
);

const Manage = ({data}) => (
    <div classNames="replace-manage">
        <Header data={data} />
        <PictureGallery data={{pics: data.pics, canGenerate: data.hasSamePosPic, planId: data.floorplan.obsPlanId, designId: data.obsDesignId}} />
    </div>
);


let render = null;
let planId = null;

export default function loadPictures(pid, mountPointSelector) {
    if (!render) {
        render = getRender(document.querySelector(mountPointSelector));
    }
    planId = pid;
    return api.getReplacements(planId).then(data => {
        data.pics = (data.roomDecoProject || [])
            .reduce((ps, project) => ps.concat(project.obsRenderPics), [])
            .sort((a, b) => b.created - a.created);
        render(<Manage data={data} />);
    });
}

export {api};

update = () => loadPictures(planId);
