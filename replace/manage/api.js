import http from '../httpClient';

export default {
    getReplacements: planId => http.get(`/vc/api/design/replace/${planId}`),
    deleteReplaceGroup: groupId => http.delete(`/vc/api/panoreplacepic/group/${groupId}`),
};
