/*
 * NC-Surf (A Chrome extension implementing virtual cookie stores) v1.2
 * Developed and maintanined by aeveret@ncsu.edu and tastocks@ncsu.edu
 * Source repository: https://github.com/alevere/iNCognito/tree/moretabs
 * Licensed under an MIT-style license. See license file for details
 */

//set global variables
const setcookie = "SET-COOKIE"; //inbound network header
const justcookie = "COOKIE"; //outbound network header
const mySeparator = "[0A:z"; //our marker for separating the cookie name from the tab
const defaultCookieSeparator = ";";
var counter = 0;
var focusTab = new Array();
var cookieCache = new Array();
var prevHosts = {};  //associative array of all open tab's hosts
var lastActiveTab;
var lastActiveTabURL;
var IncognitoTab = false;
var IncognitoOnly=false;
var presentlyIncognito=false;
var thisSuccessful=false; //see migrate()

//find when a tab is created
chrome.tabs.onCreated.addListener(function (newTab){
    //console.log("------created:" + newTab.Id + "->" + newTab.url + " " + IncognitoOnly);
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabObjectsA) {
        for(var countA=0; countA<tabObjectsA.length; countA++) {
            focusTab[countA] = tabObjectsA[countA];
        }
        for (var countB=0; countB<focusTab.length; countB++){
            if(focusTab[countB]!=null) {
                lastActiveTab = focusTab[countB].id;
                lastActiveTabURL = focusTab[countB].url;
                presentlyIncognito = focusTab[countB].incognito;
                var badgecontentsA = {text: "" + focusTab[countB].id};
                chrome.browserAction.setBadgeText(badgecontentsA);
            }
        }
    });
    migrate(0,0); //cleanup cookies
});

//find when a tab is updated
chrome.tabs.onUpdated.addListener(function (tabint, changeinfo, updTab){
    //console.log("------updated:" + tabint + "->" + changeinfo.url);
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabObjectsB) {
        for(var countC=0; countC<tabObjectsB.length; countC++) {
            focusTab[countC] = tabObjectsB[countC];
        }
        for (var countD=0; countD<focusTab.length; countD++){
            if(focusTab[countD]!=null) {
                lastActiveTab = focusTab[countD].id;
                lastActiveTabURL = focusTab[countD].url;
                presentlyIncognito = focusTab[countD].incognito;
                var badgecontentsB = {text:"" + focusTab[countD].id};
                chrome.browserAction.setBadgeText(badgecontentsB);
            }
        }
    });
	
	//compare hosts of previous url and the new url
	var urlArray = purl(changeinfo.url).attr('host').split(".");
	var currHost = urlArray[urlArray.length-2];
	if (changeinfo.url != null && prevHosts[tabint] != currHost)
	{
		//console.log("------clearing cookies: " + prevHosts[tabint] + " -> " + currHost);
		migrate(-1,tabint);
		prevHosts[tabint] = currHost;
	}
});

//find when a tab is activated
chrome.tabs.onActivated.addListener(function (activTab){
    //console.log("------activated:" + activTab.tabId);
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabObjectsC) {
        for(var countE=0; countE<tabObjectsC.length; countE++) {
            focusTab[countE] = tabObjectsC[countE];
        }
        for (var countF=0; countF<focusTab.length; countF++){
            if(focusTab[countF]!=null) {
                lastActiveTab = focusTab[countF].id;
                lastActiveTabURL = focusTab[countF].url;
                presentlyIncognito = focusTab[countF].incognito;
                var badgecontentsC = {text: "" + focusTab[countF].id};
                chrome.browserAction.setBadgeText(badgecontentsC);
            }
        }
    });
});

//find when a tab is replaced
chrome.tabs.onReplaced.addListener(function (replaced, original){
    //console.log("------replaced:" + original + " with:" + replaced);
    //migrate cookies to new tab
    migrate(replaced, original);
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabObjectsD) {
        for(var countG=0; countG<tabObjectsD.length; countG++) {
            focusTab[countG] = tabObjectsD[countG];
        }
        for (var countH=0; countH<focusTab.length; countH++){
            if(focusTab[countH]!=null) {
                lastActiveTab = focusTab[countH].id;
                lastActiveTabURL = focusTab[countH].url;
                presentlyIncognito = focusTab[countH].incognito;
                var badgecontentsD = {text: "" + focusTab[countH].id};
                chrome.browserAction.setBadgeText(badgecontentsD);
            }
        }
    });
	
	//update prevHosts
	chrome.tabs.get(replaced, function(tab) {
		var urlArray = purl(tab.url).attr('host').split(".");
		var currHost = urlArray[urlArray.length-2];
		if (tab.url != null && prevHosts[original] != currHost)
		{
			//console.log("------clearing cookies: " + prevHosts[original] + " -> " + currHost);
			migrate(-1,replaced);
			prevHosts[replaced] = prevHosts[original];
			delete prevHosts[original];
		}
	});
});

//find when a tab is removed
chrome.tabs.onRemoved.addListener(function (remTab, myobjects){
    //console.log("------removed:" + remTab);
    chrome.tabs.query({active: true, lastFocusedWindow: true}, function(tabObjectsE) {
        for(var countAA=0; countAA<tabObjectsE.length; countAA++) {
            focusTab[countAA] = tabObjectsE[countAA];
        }
        for (var countBB=0; countBB<focusTab.length; countBB++){
            if(focusTab[countBB]!=null) {
                lastActiveTab = focusTab[countBB].id;
                lastActiveTabURL = focusTab[countBB].url;
                presentlyIncognito = focusTab[countBB].incognito;
                var badgecontentsG = {text: "" + focusTab[countBB].id};
                chrome.browserAction.setBadgeText(badgecontentsG);
            }
        }
    });
    migrate(-1,remTab);
	delete prevHosts[remTab];
});

//when our extension is clicked, toggle incognito setting
chrome.browserAction.onClicked.addListener(clickedIcon);

//check for sneaky javascript cookies
chrome.cookies.onChanged.addListener(updateCookieStore);

//give cache a flush
chrome.webRequest.handlerBehaviorChanged();

//listen for network responses that contain headers
chrome.webRequest.onHeadersReceived.addListener(recvListener,{ urls: ["<all_urls>"]}, ["blocking", "responseHeaders"]);

//listen for network requests that contain headers
chrome.webRequest.onBeforeSendHeaders.addListener(reqListener,{ urls: ["<all_urls>"]}, ["blocking", "requestHeaders"]);

//listen for a new tab is created to host a navigation
//error in this function Error in response to tabs.get: ReferenceError: purl is not defined
chrome.webNavigation.onCreatedNavigationTarget.addListener(function createNavListener(details) {
	chrome.tabs.get(details.sourceTabId, function(tab) {
		//console.log("------old url: " + tab.url);
		//console.log("------new url: " + details.url);
		var oldArray = purl(tab.url).attr('host').split(".");
		var newArray = purl(details.url).attr('host').split(".");
		var oldhost = oldArray[oldArray.length-2];
		var newhost = newArray[newArray.length-2];
		//console.log("------old url host: " + oldhost);
		//console.log("------new url host: " + newhost);
		if(oldhost == newhost) {
			//console.log("------cookies copied:" + details.sourceTabId + "->" + details.tabId);
			migrate(details.tabId, details.sourceTabId);
		}
		
	});
});

//function to mark incoming cookie names with tab number
//would prefer if an API to create a cookie store was available
//May cause badhdr, not clear if this function is needed
function recvListener(incomingHeaders) {
    if (incomingHeaders!=null){
        var requestURL = incomingHeaders.url;
        var requestTab = incomingHeaders.tabId;
        var Headers = incomingHeaders.responseHeaders;
        var theEqualLocation = 0;
        var theDomainLocation = 0;
        var theSemiLocation = 0;
        var theSecondSemiLocation = 0;
        var splicepoint = 9999;
        var explodedValues = new Array();
        var upperA = "";
        var mycookiename = "";
        var mycookievalue = "";
        var mycookiedom = "";
        var mycookiepath = "";
        var mycookiesecure = false;
        var mycookiehttponly = false;
        var mycookieexpires = "";
        var cookieDate = new Date("July 1, 1978 03:30:00");
        var cookieEpoch = 0;
        //dont modify if only set to operate in incognito and this tab is not
        if (IncognitoOnly && requestTab>=0){
            chrome.tabs.get(requestTab, function(tabresult) {
                if(chrome.runtime.lastError) {}
                if(tabresult===undefined) return 0;
                if(tabresult==null) return 0;
                if (tabresult.incognito) {IncognitoTab=true;}
                });
            if (!IncognitoTab) {
                console.log("in<-" + requestTab + "-" + requestURL);
                for (indexAAD=0;indexAAD<Headers.length;indexAAD++){
                    //console.log(Headers[indexAAD].name + Headers[indexAAD].value + "\r\n");
                }
                return {responseHeaders: Headers};
            }
        }
        
        //read headers, dont modify, but set a new cookie with tab value in front
        for (index=0; index<Headers.length; index++) {
            upperA = Headers[index].name.toUpperCase();
            if (upperA===setcookie) {
               //console.log("inctab=" + requestTab);
                if (requestTab>=0){  //dont mark -1 labeled tabs
                    explodedValues = Headers[index].value.split(defaultCookieSeparator);
                    if (explodedValues.length>0){
                        for(indexAAF=0; indexAAF<explodedValues.length; indexAAF++){
                            theEqualLocation = explodedValues[indexAAF].indexOf("=");
                            //console.log(explodedValues[indexAAF]);
                            if (indexAAF==0){
                                mycookiename = explodedValues[indexAAF].substring(0,theEqualLocation);
                                mycookievalue = explodedValues[indexAAF].substring(theEqualLocation+1);
                            }
                            if(explodedValues[indexAAF].substring(0,theEqualLocation)==="DOMAIN" || explodedValues[indexAAF].substring(1,theEqualLocation)==="DOMAIN"||explodedValues[indexAAF].substring(0,theEqualLocation)==="Domain" || explodedValues[indexAAF].substring(1,theEqualLocation)==="Domain" || explodedValues[indexAAF].substring(0,theEqualLocation)==="domain" || explodedValues[indexAAF].substring(1,theEqualLocation)==="domain") {
                                mycookiedom=explodedValues[indexAAF].substring(theEqualLocation+1);
                              //  console.log(",");
                            }
                            if(explodedValues[indexAAF].substring(0,theEqualLocation)==="PATH" || explodedValues[indexAAF].substring(1,theEqualLocation)==="PATH"||explodedValues[indexAAF].substring(0,theEqualLocation)==="Path" || explodedValues[indexAAF].substring(1,theEqualLocation)==="Path" || explodedValues[indexAAF].substring(0,theEqualLocation)==="path" || explodedValues[indexAAF].substring(1,theEqualLocation)==="path") {
                                mycookiepath=explodedValues[indexAAF].substring(theEqualLocation+1);
                               // console.log("#");
                            }
                            if(explodedValues[indexAAF].substring(0,theEqualLocation)==="EXPIRES" || explodedValues[indexAAF].substring(1,theEqualLocation)==="EXPIRES"||explodedValues[indexAAF].substring(0,theEqualLocation)==="Expires" || explodedValues[indexAAF].substring(1,theEqualLocation)==="Expires" || explodedValues[indexAAF].substring(0,theEqualLocation)==="expires" || explodedValues[indexAAF].substring(1,theEqualLocation)==="expires") {
                                mycookieexpires=explodedValues[indexAAF].substring(theEqualLocation+1);
                                //console.log("]");
                            }
                            if(explodedValues[indexAAF].substring(0)==="HTTPONLY" || explodedValues[indexAAF].substring(1)==="HTTPONLY"||explodedValues[indexAAF].substring(0)==="HttpOnly" || explodedValues[indexAAF].substring(1)==="HttpOnly" || explodedValues[indexAAF].substring(0)==="httponly" || explodedValues[indexAAF].substring(1)==="httponly") {
                                mycookiehttponly=true;
                               // console.log("*");
                            }
                            if(explodedValues[indexAAF].substring(0)==="SECURE" || explodedValues[indexAAF].substring(1)==="SECURE"||explodedValues[indexAAF].substring(0)==="Secure" || explodedValues[indexAAF].substring(1)==="Secure" || explodedValues[indexAAF].substring(0)==="secure" || explodedValues[indexAAF].substring(1)==="secure") {
                                mycookiesecure=true;
                               // console.log("^");
                            }
                        }
                    }
                    cookieDate = new Date(mycookieexpires);
                    cookieEpoch = cookieDate.getTime()/1000.0;
                    //console.log(cookieEpoch);
                    //add the expires attribute
                    if (mycookiedom.length>2 && mycookiepath.length>2){
                        if (mycookieexpires.length>2) {
                            chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, domain: "" + mycookiedom, path: "" + mycookiepath, httpOnly: mycookiehttponly, secure: mycookiesecure, expirationDate: cookieEpoch});
                        }
                        else
                        chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, domain: "" + mycookiedom, path: "" + mycookiepath, httpOnly: mycookiehttponly, secure: mycookiesecure});
                       // console.log("set " + requestTab + mySeparator + mycookiename + mycookievalue + mycookiedom + mycookiepath);
                    }
                    if (mycookiedom.length>2 && mycookiepath.length<2){
                        if (mycookieexpires.length>2) {
                           chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, domain: "" + mycookiedom, httpOnly: mycookiehttponly, secure: mycookiesecure, expirationDate: cookieEpoch});
                        }
                        else
                        chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, domain: "" + mycookiedom, httpOnly: mycookiehttponly, secure: mycookiesecure});
                       // console.log("set " + requestTab + mySeparator + mycookiename + mycookievalue + mycookiedom);
                    }
                    if (mycookiedom.length<2 && mycookiepath.length>2){
                        if (mycookieexpires.length>2) {
                            chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, path: "" + mycookiepath, httpOnly: mycookiehttponly, secure: mycookiesecure, expirationDate: cookieEpoch});
                        }
                        else
                        chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, path: "" + mycookiepath, httpOnly: mycookiehttponly, secure: mycookiesecure});
                        //console.log("set " + requestTab + mySeparator + mycookiename + mycookievalue + mycookiepath);
                    }
                    if (mycookiedom.length<2 && mycookiepath.length<2){
                        if (mycookieexpires.length>2) {
                            chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, httpOnly: mycookiehttponly, secure: mycookiesecure, expirationDate: cookieEpoch});
                        }
                        else
                        chrome.cookies.set({url: "" + requestURL, name: "" + requestTab + mySeparator + mycookiename, value: "" + mycookievalue, httpOnly: mycookiehttponly, secure: mycookiesecure});
                    }
                    //console.log("sets " + requestTab + mySeparator + mycookiename + mycookievalue);
                    //console.log(mycookiehttponly + " " + mycookiesecure);
                    //Headers[index].value = requestTab + mySeparator + Headers[index].value; //modify cookie name
                    //Headers[index].value = Headers[index].value.substring(0,(theEqualLocation+1)) + requestTab + mySeparator + Headers[index].value.substring((theEqualLocation+1)); //modify cookie value
                }
               //console.log(Headers[index]);
            }
        }
        
        console.log("in<-" + requestTab + "-" + requestURL);
        for (indexAAB=0;indexAAB<2;indexAAB++){
            //console.log(Headers[indexAAB].name + Headers[indexAAB].value + "\r\n");
        }
    }
    return {responseHeaders: Headers};
}

//function to strip tab number where appropriate from cookies
// does not cause badhdr in GMAIL_IMP
function reqListener(outgoingHeaders) {
    var tabPosition = 0;
    if (outgoingHeaders!=null){
        var requestURL = outgoingHeaders.url;
        var requestTab = outgoingHeaders.tabId;
        var cookiesTab = 28998;
        var Headers = outgoingHeaders.requestHeaders;
        var cookieArray;
        var tempHeader = "";
        var foundSeparatorPosition = 28999;
        var processedHeader = "";
        var splicepoint = 9999;
        var upper;
        //dont modify if only set to operate in incognito and this tab is not
        if (IncognitoOnly && requestTab>=0){
            chrome.tabs.get(requestTab, function(tabresult) {
                if(chrome.runtime.lastError) {}
                if(tabresult===undefined) return 0;
                if(tabresult==null) return 0;
                if (tabresult.incognito) {IncognitoTab=true;}
                });
            if (!IncognitoTab) {
                console.log("out-" + requestTab + "->" + requestURL);
                for (indexAAE=0;indexAAE<Headers.length;indexAAE++){
                    //console.log(Headers[indexAAE].name + Headers[indexAAE].value + "\r\n");
                }
                return {requestHeaders: Headers};
            }
        }
        for (indexA=0; indexA<Headers.length; indexA++) {
            upper=Headers[indexA].name.toUpperCase();
            if (upper===justcookie) {
                tempHeader = Headers[indexA].value;
                //call function to inspect and/or modify outbound headers
                //console.log("pre ==" + processedHeader);
                processedHeader = tabLogic(tempHeader, requestURL, requestTab);
                Headers[indexA].value = "" + processedHeader;
                if (Headers[indexA].value.length<3) {
                    Headers[indexA].name = "";
                    splicepoint = indexA;  //mark which header entry to delete as there are no cookies
                    console.log("splice");
                }
            }
        }
        console.log("out-" + requestTab + "->" + requestURL);
        Headers.splice(splicepoint,1);
        for (indexAAA=0;indexAAA<2;indexAAA++){
          // console.log(Headers[indexAAA].name + Headers[indexAAA].value + "\r\n");
        }
    }
    return {requestHeaders: Headers};
}

//function to analyze cookie jar and browser
//used with sending cookies
function tabLogic(CookieHeaderValue, url, sendingTab ) {
    var foundSeparatorPosition = 30999;
    var cookiesTab = 30998;
    var cookieArray;
    var tamperedCookieHeaderValue = CookieHeaderValue;
    var tamperedCookieString = "";
    var equalsLocation = 0;
    var imp;  //handle GMAIL_IMP cookie
    var tempLocator=0;
    var tempLocatorA=0;
    var matchName = false; //whether to modify cookie name or value
    cookieArray = tamperedCookieHeaderValue.split(defaultCookieSeparator);
    for (indexB=0; indexB<cookieArray.length; indexB++){
        foundSeparatorPosition = cookieArray[indexB].indexOf(mySeparator);
        if (foundSeparatorPosition>=0){
            equalsLocation = cookieArray[indexB].indexOf("=");
            if (matchName) {
                equalsLocation++;
                if (foundSeparatorPosition==0) cookiesTab=0;
                else
                 cookiesTab=parseInt(cookieArray[indexB].substring(equalsLocation,foundSeparatorPosition),10);
            }
            else{
                if (foundSeparatorPosition==0) cookiesTab=0;
                else cookiesTab=parseInt(cookieArray[indexB].substring(0,foundSeparatorPosition),10);
            }
            //console.log("ctab=" + cookiesTab + "; actab=" + sendingTab + "; " + cookieArray[indexB]);
            if (cookiesTab==sendingTab) { //cookies were set in the same tab we are in
                if (matchName)
                    tamperedCookieString = tamperedCookieString + cookieArray[indexB].substring(0,equalsLocation) + cookieArray[indexB].substring((foundSeparatorPosition+5)) + defaultCookieSeparator;
                else {
                    tamperedCookieString = tamperedCookieString + cookieArray[indexB].substring(foundSeparatorPosition+5) + defaultCookieSeparator;
                }
            }
            else {
                tamperedCookieString = tamperedCookieString;  //do NOT include cookies for other tabs
            }
        }
        else {
            tamperedCookieString = tamperedCookieString; //do NOT include unmarked cookies
        }
    }
    if (tamperedCookieString.charAt(tamperedCookieString.length-1)===";" && tamperedCookieString.length>1) {
        tamperedCookieString = tamperedCookieString.substring(0,tamperedCookieString.length-1)  //subtract trailing semi-colon
        //console.log("removed semicolon");
    }
    if (tamperedCookieString.length<2)  tamperedCookieString="";
    return tamperedCookieString;
}


//function to handle incoming cookies without tab and marker
function updateCookieStore(changedata){
    var updCookie = changedata.cookie;
    var updCookieName = updCookie.name;
    var updCookieValue = updCookie.value;
    var updCookieDomain = updCookie.domain;
    var updCookieExpiry = updCookie.expirationDate;
    var updCookiePath = updCookie.path;
    var updCookieHTTP = updCookie.httpOnly;
    var updCookieSecure = updCookie.secure;
    var separatorLocation = 56022;
    var separatorMarker = 40294;
    var sameDomainTab = new Array(); //array of tabs matched
    var sameNameTab = new Array(); //array of names matched
    var countJ=0;
    var countK=0;
    var nameIdMatch = false;
    var firstMatch = 0;
    var successVal;
    var matchesActive = false;
    var skip = false;
    if (updCookiePath==null) updCookiePath="/";
    separatorLocation = updCookieName.indexOf(mySeparator);
    if (separatorLocation>=0){
        //console.log("found separator on cookie change");
        //nothing to do
    }
    else {
        console.log("cookiechange:" + updCookieName + "=" + updCookieValue + " dom:" + updCookieDomain + "path:" + updCookiePath);
        thisTabIncognitoD = 0;
        if (IncognitoOnly){
            console.log("+")
            if (presentlyIncognito==false) skip=true;
        }
        if (!skip){
            if (lastActiveTab==null) {}
            else if (lastActiveTab===undefined) {}
            else {
                //need to delete unmarked cookies?
                //set tab number in front of cookie name
                console.log(".");
                //slow due to timing issues, results in cookies not existing in time.
                //need to change in request
                if (updCookieDomain==null){
                    
                }
                else {
                    if (lastActiveTabURL===undefined) {}
                    else if (lastActiveTabURL==null) {}
                    else {
                        //compare our URL to the incoming cookies
                        if (lastActiveTabURL.indexOf(updCookieDomain.substring(1))>=0) {
                         }
                    }
                         
                    
                }
                /*
                else if (updCookieExpiry==null) {
                    chrome.cookies.set({url: "https://" + updCookieDomain + updCookiePath, name: "" + lastActiveTab + mySeparator + updCookieName, value: "" + updCookieValue, domain: "" + updCookieDomain, path: "" + updCookiePath,secure: updCookieSecure, httpOnly: updCookieHTTP});
                    chrome.cookies.set({url: "http://" + updCookieDomain + updCookiePath, name: "" + lastActiveTab + mySeparator + updCookieName, value: "" + updCookieValue, domain: "" + updCookieDomain, path: "" + updCookiePath, secure: updCookieSecure, httpOnly: updCookieHTTP});
                }
                else {
                    chrome.cookies.set({url: "https://" + updCookieDomain + updCookiePath, name: "" + lastActiveTab + mySeparator + updCookieName, value: "" + updCookieValue, domain: "" + updCookieDomain, path: "" + updCookiePath, expirationDate: updCookieExpiry,secure: updCookieSecure, httpOnly: updCookieHTTP});
                    chrome.cookies.set({url: "http://" + updCookieDomain + updCookiePath, name: "" + lastActiveTab + mySeparator + updCookieName, value: "" + updCookieValue, domain: "" + updCookieDomain, path: "" + updCookiePath, expirationDate: updCookieExpiry,secure: updCookieSecure, httpOnly: updCookieHTTP});
                }
                */
            }
        }
    }
    //migrate(0,0); //cleanup cookies
    //chrome.cookies.getAll({},cookieChecker);  //slow
}

//function to keep a cache of cookies based on updated calls to getallcookies()
function cookieChecker(myArray){
    cookieCache = myArray;
}

function tabCall(tabObjectG){
    if(chrome.runtime.lastError) console.log("tab doesnt exist:");
    return 0;
}

//function to move cookies to new tabId
function migrate (newID, oldID) {
    var cookieTabValue=93532;
    var cookieTabValueString = "";
    var separatorPlace=0;
    var skipping = false;
    chrome.cookies.getAll({},cookieChecker);
    if (IncognitoOnly){
        console.log("+")
        if (presentlyIncognito==false) skipping=true;
    }
    if (skipping) {}
    else {
        for(countQ=0; countQ<cookieCache.length; countQ++){
            thisSuccessful=0;
            separatorPlace = cookieCache[countQ].name.indexOf(mySeparator);
            if (separatorPlace>=0) {
                cookieTabValueString = cookieCache[countQ].name.substring(0,separatorPlace);
                if (separatorPlace>0)cookieTabValue = parseInt(cookieTabValueString);
                //console.log("z" + cookieTabValue + "x" + separatorPlace);
                //try to find missing tabs
                if (cookieTabValue>=0) {
                    chrome.tabs.get(cookieTabValue, function(tabresulted) {
                    if(chrome.runtime.lastError) {}
                    if(tabresulted===undefined) return 0;
                    if(tabresulted==null) return 0;
                    if (tabresulted.windowId>=0) {thisSuccessful=true;}
                    });
                }
                if (cookieTabValue==93532) {
                    chrome.cookies.remove({url: "https://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                    chrome.cookies.remove({url: "http://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                }
                else {   //delete cookies with tabs < 0
                    chrome.cookies.remove({url: "https://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + oldID + mySeparator + cookieCache[countQ].name.indexOf(mySeparator+5)});
                    chrome.cookies.remove({url: "https://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + oldID + mySeparator + cookieCache[countQ].name.indexOf(mySeparator+5)});
                }
                if (cookieTabValue==oldID) {
                    console.log("Need to migrate me" + cookieCache[countQ].name + oldID + " to " + newID);
                    chrome.cookies.remove({url: "https://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                    chrome.cookies.remove({url: "http://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                    if(newID>=0 && thisSuccessful){  //only migrate tabs with IDs > 0 and where the new window is active
                        console.log("migrated " + newID + mySeparator + cookieCache[countQ].name.substring(mySeparator+5));
                        chrome.cookies.set({url: "https://"+cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + newID + mySeparator + cookieCache[countQ].name.substring(mySeparator+5), value: "" + cookieCache[countQ].value, domain: "" + cookieCache[countQ].domain, path: "" + cookieCache[countQ].path, expirationDate: cookieCache[countQ].expirationDate,secure: cookieCache[countQ].secure, httpOnly: cookieCache[countQ].httpOnly});
                        chrome.cookies.set({url: "http://"+cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + newID + mySeparator + cookieCache[countQ].name.substring(mySeparator+5), value: "" + cookieCache[countQ].value, domain: "" + cookieCache[countQ].domain, path: "" + cookieCache[countQ].path, expirationDate: cookieCache[countQ].expirationDate,secure: cookieCache[countQ].secure, httpOnly: cookieCache[countQ].httpOnly});
                    }
                }
            }
            else { //eliminate cookies not related to a tab
                
                chrome.cookies.remove({url: "https://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                chrome.cookies.remove({url: "http://" + cookieCache[countQ].domain + cookieCache[countQ].path, name: "" + cookieCache[countQ].name});
                
                
            }
        }
    }
}

//function to handle icon click
function clickedIcon(atabobj) {
    if (IncognitoOnly) IncognitoOnly=false;
    else IncognitoOnly=true;
    alert("You just toggled whether this only operates in Incognito mode. This icon also shows the current tab number.");
    chrome.browserAction.setIcon({path: "small_icon_b.png"});
}