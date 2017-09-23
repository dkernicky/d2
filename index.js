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
    return get(`http://www.bungie.net/Platform/Destiny2/SearchDestinyPlayer/-1/${displayName}`)
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

function getPostGameCarnage(activityId, membershipId) {
    let obj = {}
    obj['medals'] = {}

    return get(`http://www.bungie.net/Platform//Destiny2/Stats/PostGameCarnageReport/${activityId}/`)
    .then(result => {
        let stats = result.entries.find(entry => {
            // console.log(entry.player.destinyUserInfo.displayName + ' vs ' + displayName)
            // return (entry.player.destinyUserInfo.displayName.trim() == displayName.trim())
            return (entry.player.destinyUserInfo.membershipId == membershipId)

        })

        // TODO add character info back in
        Object.keys(stats.values).forEach(key => {
            // console.log('Found ' + key)
            obj[key] = stats.values[key].basic.value
        })

        Object.keys(stats.extended.values).forEach(key => {
            obj['medals'][key] = stats.extended.values[key].basic.value
        })

        return Promise.resolve(obj)
    })
}

function getAggregateCarnage(carnage) {
    let data = carnage.reduce((a, b) => {
        let obj = {}
        obj['medals'] = a.medals
        Object.keys(a).forEach(key => {
            if (key != 'medals') {
                obj[key] = (a[key] + b[key])
            }
        })

        Object.keys(b.medals).sort().forEach(key => {
            if (a.medals[key]) {
                obj.medals[key] = a.medals[key] + b.medals[key]
            } else {
                obj.medals[key] = b.medals[key]
            }
        })
        return obj
    })
    // console.log(data)

    return Promise.resolve({
        games: carnage.length,
        wins: carnage.length - data.standing,
        kills: data.kills,
        assists: data.assists,
        deaths: data.deaths,
        kd: data.kills / data.deaths,
        kad: (data.kills + data.assists) / data.deaths,
        kda: (data.kills + (data.assists)/2) / data.deaths,
        avgScore: data.score / carnage.length,
        medals: data.medals

    })
}

let membershipId = ''
let displayName = process.argv[2]
getMembershipId(displayName)
.then(result => {
    membershipId = result
    console.log(membershipId)
    return getCharacterIds(membershipId)
})
.then(characterIds => {
    console.log(characterIds)
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
        promises.push(getPostGameCarnage(activityId, membershipId))
    })
    return Promise.all(promises)
})
.then(carnage => {
    //console.log(carnage)
    return getAggregateCarnage(carnage)
    //  console.log(carnage)
})
.then(result => {
    console.log(result)
})
