var stateKey = 'spotify_auth_state';

/**
 * Obtains parameters from the hash of the URL
 * @return Object
 */
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function collectLibraryTracks(token) {
    let next = true;
    let offset = 0;
    let tracks = [];
    const track_limit = 50;
    while (next) {
        var result;
        $.ajax({
            url: "https://api.spotify.com/v1/me/tracks",
            headers: {"Authorization": "Bearer " + token},
            type: "get", //send it through get method
            data: {
                market: 'DE',
                limit: track_limit,
                offset: offset
            },
            success: function (response) {
                result = response;
            },
            error: function (response, status, error) {
                if (response.status === 429) {
                    console.log('failure');
                    setTimeout(() => {
                        console.log('retrying');
                        $.ajax(this);
                    }, 3600);
                }
            },
            async: false
        });
        tracks = tracks.concat(result['items']);
        offset += track_limit;
        console.log("Loaded ", tracks.length, " from library.");
        if (result['next'] === null) {
            console.log('reached end');
            next = false;
        }
    }
    return tracks;
}

function makeDataFrame(tracks) {
    tracks = tracks.map(function (obj) {
        obj['track']['added_at'] = obj['added_at'];
        return obj['track'];
    });
    for (let i = 0; i < tracks.length; i++) {
        delete tracks[i].linked_from;
    }
    return new dfd.DataFrame(tracks);
}

function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

async function add_artist_info(df, token) {

    var artist_ids;
    var artist_followers;//=new dfd.Series({'artist_followers':[]});
    var artist_genres;//=new dfd.Series({'artist_genres':[]});
    var artist_popularity;//=new dfd.Series({'artist_popularity':[]});


    for (let i = 0; i < df.index.length; i += 50) {
        artist_ids = "";
        for (let j = i; j < i + 50 && j < df.index.length; j++) {
            artist_ids += df.at(j, 'artists')[0]['id'];
            if (j < i + 49 && j < df.index.length - 1) {
                artist_ids += ',';
            }
        }
        var result;
        $.ajax({
            url: "https://api.spotify.com/v1/artists",
            headers: {"Authorization": "Bearer " + token},
            type: "get", //send it through get method
            data: {
                ids: artist_ids
            },
            success: function (response) {
                result = response;
            },
            error: function (response, status, error) {
                if (response.status === 429) {
                    console.log('failure');
                    setTimeout(() => {
                        console.log('retrying');
                        $.ajax(this);
                    }, 3600);
                }
            },
            async: false
        });

        sf1 = new dfd.Series({'artist_followers': result['artists'].map(x => x['followers']['total'])});
        sf2 = new dfd.Series({'artist_genres': result['artists'].map(x => x['genres'])});
        sf3 = new dfd.Series({'artist_popularity': result['artists'].map(x => x['popularity'])});

        if (typeof artist_followers == 'undefined') {
            artist_followers = sf1;
            artist_genres = sf2;
            artist_popularity = sf3;
        } else {
            artist_followers.append(sf1, range(sf1.index.length, artist_followers.index.length), {inplace: true});
            artist_genres.append(sf2, range(sf2.index.length, artist_genres.index.length), {inplace: true});
            artist_popularity.append(sf3, range(sf3.index.length, artist_popularity.index.length), {inplace: true});
        }
        console.log("Got artist info for ", artist_followers.index.length, " tracks.");
    }
    df.addColumn('artist_followers', artist_followers, {inplace: true});
    df.addColumn('artist_genres', artist_genres, {inplace: true});
    df.addColumn('artist_popularity', artist_popularity, {inplace: true});
    return df;
}

function add_audio_info(df, token) {
    var track_ids;
    var features = ['danceability', 'energy', 'loudness', 'speechiness', 'acousticness', 'instrumentalness',
        'liveness', 'valence', 'tempo'];
    var seriess_complete = [];

    const step_size = 100;
    for (let i = 0; i < df.index.length; i += step_size) {
        track_ids = "";
        for (let j = i; j < i + step_size && j < df.index.length; j++) {
            track_ids += df.at(j, 'id');
            if (j < i + (step_size - 1) && j < df.index.length - 1) {
                track_ids += ',';
            }
        }
        var result;
        $.ajax({
            url: "https://api.spotify.com/v1/audio-features",
            headers: {"Authorization": "Bearer " + token},
            type: "get", //send it through get method
            data: {
                ids: track_ids
            },
            success: function (response) {
                result = response;
            },
            error: function (response, status, error) {
                if (response.status === 429) {
                    console.log('failure');
                    setTimeout(() => {
                        console.log('retrying');
                        $.ajax(this);
                    }, 3600);
                }
            },
            async: false
        });

        seriess = [];
        for (let j = 0; j < features.length; j++) {
            feature = features[j];
            seriess.push(new dfd.Series({feature: result['audio_features'].map(y => y[feature])}));
        }
        if (seriess_complete.length === 0) {
            for (let j = 0; j < features.length; j++) {
                seriess_complete.push(seriess[j])
            }
        } else {
            for (let j = 0; j < features.length; j++) {
                seriess_complete[j].append(seriess[j], range(seriess[j].index.length, seriess_complete[j].index.length), {inplace: true});
            }
        }
        console.log("Got track info for ", seriess_complete[0].index.length, " tracks.");
    }
    for (let i = 0; i < features.length; i++) {
        df.addColumn(features[i], seriess_complete[i], {inplace: true});
    }
    return df;
}


function drop_columns(df) {
    const columns = ['album', 'external_ids', 'external_urls', 'href', 'id', 'is_local', 'is_playable',
        'external_urls', 'href', 'id', 'type', 'uri', 'preview_url'];
    df.drop({columns: columns, inplace: true});
    return df;
}

function fix_artist_names(df) {
    let artists = df.loc({columns: ["artists"]});
    df.drop({columns: ["artists"], inplace: true});
    artists = artists.applyMap((a) => {
        return a[0]["name"]
    });
    df = dfd.concat({dfList: [df, artists], axis: 1});
    df.rename({"artists": "artist"}, {inplace: true});
    return df;
}

function show_loader() {
    document.getElementById("loader").style.display = 'block';
}

function show_collecting_tracks() {
    document.getElementById("plot_div1").innerHTML = 'Collecting the tracks from your library. This might take a moment...'
}

function show_collecting_artist_info() {
    document.getElementById("plot_div1").innerHTML = 'Collecting artist information for your tracks. This might take a moment...'
}

function show_collecting_audio_info() {
    document.getElementById("plot_div1").innerHTML = 'Collecting additional audio features for your tracks. This might take a moment...'
}

function show_finished() {
    document.getElementById("plot_div1").innerHTML = '';
    document.getElementById("loader").style.display = 'none';
    document.getElementById('text_1').innerHTML = 'Your stats are now available:'
}


function make_pie_plot(df) {
    let genre_counts = {};
    for (let row = 0; row < df.index.length; row++) {
        let genres = df.at(row, 'artist_genres');
        for (let i = 0; i < genres[0].length; i++) {
            let genre = genres[0][i];
            if (genre in genre_counts) {
                genre_counts[genre]++;
            } else {
                genre_counts[genre] = 1;
            }
        }
    }
    let sum = Object.keys(genre_counts).reduce(function (sum, key) {
        return sum + genre_counts[key]
    }, 0);
    let keys = null;
    let all_genres = Object.keys(genre_counts);
    while (Object.keys(genre_counts).length > 10) {  // keep only 10 biggest genres
        keys = Object.keys(genre_counts);
        //find smallest genre
        let min_genre = null;
        let min = Infinity;
        let genre = null;
        for (let i = 0; i < keys.length; i++) {
            genre = keys[i];
            if (genre_counts[genre] < min) {
                min_genre = genre;
                min = genre_counts[genre];
            }
        }
        delete genre_counts[min_genre]
    }
    let genres = Object.keys(genre_counts);
    let counts = Object.keys(genre_counts).map(function (key) {
        return genre_counts[key];
    });
    Plotly.newPlot('plot_div2', [{
        values: counts,
        labels: genres,
        type: 'pie'
    }], {});
    return genres;
}

function make_stacked_bar_plot(df, genres, min_year, max_year, date_times) {
    let years = range(max_year - min_year + 1, min_year);
    let genre_counts = {};
    for (let i = 0; i < genres.length; i++) {
        genre_counts[genres[i]] = {
            x: years,
            y: [...Array(years.length).keys()].map(i => 0),
            name: genres[i],
            type: 'bar'
        };
    }
    for (let row = 0; row < df.index.length; row++) {
        let genres = df.at(row, 'artist_genres');
        let year = date_times.year().iat(row);
        for (let i = 0; i < genres[0].length; i++) {
            let genre = genres[0][i];
            if (genre in genre_counts) {
                genre_counts[genre]['y'][year - min_year]++;
            }
        }
    }
    Plotly.newPlot('plot_div3', Object.values(genre_counts), {barmode: 'stack'})
}

var global_df;

async function compute_plots(token) {
    show_loader();
    show_collecting_tracks();
    const tracks = await collectLibraryTracks(token);
    let df = await makeDataFrame(tracks);
    show_collecting_artist_info();
    df = await add_artist_info(df, token);
    show_collecting_audio_info();
    df = await add_audio_info(df, token);
    show_finished();
    df = drop_columns(df);
    df = fix_artist_names(df);
    df.plot("plot_div1").line({
        config: {
            x: 'added_at', y: 'artist_popularity'
        }
    });
    let genres = make_pie_plot(df);
    global_df = df;
    let dates = dfd.toDateTime(df['added_at']);
    let min_year = dates.year().min();
    let max_year = dates.year().max();
    make_stacked_bar_plot(df, genres, min_year, max_year, dates);
}

function removeHash() {
    history.pushState("", document.title, window.location.pathname
        + window.location.search);
}

let params = getHashParams();

let access_token = params.access_token,
    state = params.state,
    storedState = localStorage.getItem(stateKey);

if (access_token && (state == null || state !== storedState)) {
    alert('There was an error during the authentication');
} else {
    removeHash();
    localStorage.removeItem(stateKey);
    if (access_token) {
        document.getElementById('login-button').style.display = "none";
        document.getElementById('text_1').style.display = 'block';
        $.ajax({
            url: 'https://api.spotify.com/v1/me',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function (response) {
                document.getElementById("main_heading").innerHTML = "Welcome at Spotilytics, " + response.display_name;
            }
        });
        compute_plots(access_token)
    } else {
    }

    document.getElementById('login-button').addEventListener('click', function () {

        let client_id = '377f99f3c4f6461c9704b0b463b8f951'; // Your client id
        //let redirect_uri = 'https://philipzimmermann.github.io/spotilytics'; // Your redirect uri
        let redirect_uri = 'http://localhost:63342/phixxx5.github.io/spotilytics.html';

        let state = generateRandomString(16);

        localStorage.setItem(stateKey, state);
        let scope = 'user-read-private user-read-email user-library-read user-top-read';

        let url = 'https://accounts.spotify.com/authorize';
        url += '?response_type=token';
        url += '&client_id=' + encodeURIComponent(client_id);
        url += '&scope=' + encodeURIComponent(scope);
        url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
        url += '&state=' + encodeURIComponent(state);

        window.location = url;
    }, false);
}
