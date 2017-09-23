'use strict';
const superagent = require('superagent');
const Promise = require('bluebird');

function get(f, q, attempt) {
    let query = q ? q : {};
    return new Promise((resolve, reject) => {
        superagent
            .get(f)
            .query(query)
            .set('X-API-Key', '785fac597413481c82cba8446c87d31d')
            .end((err, res) => {
                if (err) {
                    console.log('err: ' + err);
                    reject(err);
                } else {
                    resolve(res.body.Response);
                }
            })
    })
    .catch(err => {
        console.log('Error: ' + err);
    });
}

function getMembershipId(displayName) {
    return get('http://www.bungie.net/Platform/Destiny2/SearchDestinyPlayer/-1/Crimson_Wrath')
    .then(result => {
        return Promise.resolve(result[0].membershipId)
    })
}

function getCharacterIds(membershipId) {
    return get(`http://www.bungie.net/Platform/Destiny2/2/Profile/${membershipId}/`, { components: 100})
    .then(result => {
        return Promise.resolve(result.profile.data.characterIds)
    })
}

// TODO filter by date
function getActivities(membershipId, characterId, mode, activities=[], page=0) {
    return get(`http://www.bungie.net/Platform/Destiny2/-1/Account/${membershipId}/Character/${characterId}/Stats/Activities/`, { count: 250, mode: mode, page: page })
    .then(result => {
        if (result.activities) {
            activities = activities.concat(result.activities.map(activity => {
                return activity.activityDetails.instanceId
            }))
            return getActivities(membershipId, characterId, mode, activities, page += 1)
        } else {
            return Promise.resolve(activities)
        }
    })
}

function getPostGameCarnage(activityId, displayName) {
    return get(`http://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`)
    .then(result => {
        let me = result.entries.filter(entry => {
            // console.log(entry.player.destinyUserInfo.displayName + ' vs ' + displayName)
            // console.log('Equal? ' + (entry.player.destinyUserInfo.displayName == displayName))
            return (entry.player.destinyUserInfo.displayName == displayName)
        })
        // console.log(me)
        return Promise.resolve(me)
        // return Promise.resolve(result.entries.filter(entry => {
        //     // console.log(entry.player.destinyUserInfo.displayName + ' vs ' + displayName)
        //     // console.log('Equal? ' + (entry.player.destinyUserInfo.displayName == displayName))
        //     return (entry.player.destinyUserInfo.displayName == displayName)
        // }))
    })
}

let membershipId = ''
let displayName = 'Crimson_Wrath'
getMembershipId('Crimson_Wrath')
.then(result => {
    membershipId = result
    // console.log(membershipId)
    return getCharacterIds(membershipId)
})
.then(characterIds => {
    // console.log(characterIds)
    // TODO filter on character
    let promises = []
    characterIds.forEach(character => {
        promises.push(getActivities(membershipId, character, 5))
    })
    return Promise.all(promises)
    .then(activities => {
        return Promise.resolve(activities[0].concat(activities[1]).concat(activities[2]).sort())
    })
})
.then(activityIds => {
    let promises = []
    activityIds.forEach(activityId => {
        promises.push(getPostGameCarnage(activityId, displayName))
    })
    return Promise.all(promises)
})
.then(carnage => {
     console.log(carnage)
})
