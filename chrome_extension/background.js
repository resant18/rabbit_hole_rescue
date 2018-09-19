"use strict";

chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
  chrome.declarativeContent.onPageChanged.addRules([
    {
      conditions: [new chrome.declarativeContent.PageStateMatcher({})],
      actions: [new chrome.declarativeContent.ShowPageAction()]
    }
  ]);
});

let username;

chrome.runtime.onMessage.addListener(function(message) {
  console.log(message)
  let currNode = { _id: null };

  if (message.sender === "login") {
    username = message.username;
  }

  const getWindow = windowId => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", `http://localhost:5000/api/windows/${username}/${windowId}`, true);
    xhr.onload = function () {
      if (xhr.readyState === xhr.DONE) {
        if (xhr.status === 200) {
          let response = JSON.parse(xhr.response);
          // console.log(response);
          return response;
        } else {
          console.log("Could not make a determination");
        }
      }
    };
    xhr.send();
  }

  const getVisit = tab => {
    // console.log(visit);
    let xhr = new XMLHttpRequest();
    xhr.open("GET", `http://localhost:5000/api/windows/${username}/${tab.windowId}/${tab.id}/${tab.url}`, true)
    xhr.onload = function() {
      if (xhr.readyState === xhr.DONE) {
        if (xhr.status === 200) {
          let response = JSON.parse(xhr.response);
          // console.log(response);
          return response;
        } else {
          console.log("Could not make a determination");
        }
      }
    };
    xhr.send();
  }

  const setChildren = visit => {
    let par = visit.parent;
    if (par) {
      let xhr = new XMLHttpRequest();
      let str = `id=${par}&children=${visit._id}`;
      xhr.open("PATCH", `http://localhost:5000/api/visits/update`, true);
      xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      xhr.onreadystatechange = function() {
        if(xhr.readyState === 4 && xhr.status === 200) {
          let response = JSON.parse(xhr.response);
          return response;
        }
      }
      if (str) {xhr.send(str)};
    }
  };

  const createWindow = windowId => {
    let xhr = new XMLHttpRequest();
    let str = `id=${windowId}&visits=${[]}&username=${username}`;
    xhr.open("POST", `http://localhost:5000/api/windows/`, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        let response = JSON.parse(xhr.response);
        // console.log(xhr.responseText);
        return response;
      }
    };
    if (str) { xhr.send(str) };
  };

  const addVisits = visit => {
    //get visit req here
    // console.log(visit);
    let xhr = new XMLHttpRequest();
    let str = `id=${visit.chromeWindowId}&visits=${visit._id}`;
    xhr.open("PATCH", `http://localhost:5000/api/windows/${username}/update`, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        let response = JSON.parse(xhr.response);
        // console.log(xhr.responseText);
        return response;
      }
    };
    if (str) { xhr.send(str) };
  };

  const historyNode = visit => {
    // get request here
    let res = getVisit(visit);
    // console.log(res);
    return res;
  };

  const createNode = tab => {
    let newNode = {
      url: tab.url,
      title: tab.title,
      chromeTabId: tab.id,
      chromeWindowId: tab.windowId,
      children: [],
      username: username
    };
    // console.log(currNode);
    if (currNode.chromeTabId === newNode.chromeTabId) {
      console.log("Setting parent");
      newNode.parent = currNode._id;
    } else {
      newNode.parent = null;
    }
    return newNode;
  };

  const createVisit = visit => {
    let xhr = new XMLHttpRequest();
    if (visit.parent) {setChildren(visit)};
   
    let parent = visit.parent ? visit.parent : -1;
    let str = `title=${visit.title}&url=${
      visit.url
      }` + `&chromeTabId=${visit.chromeTabId}&chromeWindowId=${
      visit.chromeWindowId
      }&parent=${parent}&children=${
      visit.children
      }&username=${username}`;

    xhr.open("POST", "http://localhost:5000/api/visits/", true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        let response = JSON.parse(xhr.response);
        addVisits(response);
        return response;
      }
    };
    if (str) {xhr.send(str)};
  };

  const setCurrNode = () => {
    // GET request
    chrome.tabs.query(
      { active: true, lastFocusedWindow: true, windowId: currNode.chromeWindowId },
      function(tab) {
        let currTab = tab[0];
        // console.log(currTab);
        let node = getVisit(currTab);
        // console.log(node); just track, backend handle rest?
        if (node) {
          currNode = node;
          return currNode;
        }
      }
    );
  };

  const activatedListener = () => {
    console.log("Current Node is...");
    setCurrNode();
    console.log(currNode);
  };

  const updatedListener = (visitId, changeInfo, visit) => {
    let res = getWindow(visit.windowId)
    // console.log(res);
    if (!res) {
      createWindow(visit.windowId);
    }

    if (changeInfo.url !== undefined && changeInfo.url !== "chrome://newtab/") {
      let histNode = historyNode(visit);

      if (histNode) {
        currNode = histNode;
      } else {
        let newNode = createNode(visit);
        setCurrNode();
        createVisit(newNode);
      }
      
    }
  };

  if (message.sender === "start") {
    const sleep = time => {
      let start = new Date().getTime();
      while (new Date().getTime() < start + time);
    };

    chrome.windows.getAll({ populate: true, windowTypes: ["normal"] }, function(
      windows
    ) {
      windows.forEach(window => {
        createWindow(window.id);
        window.tabs.forEach(visit => {
          let newNode = createNode(visit);
          createVisit(newNode);
          sleep(250);
        });
      });
      setCurrNode();

      chrome.tabs.onActivated.addListener(activatedListener);
      chrome.tabs.onUpdated.addListener(updatedListener);
    });
  }

  if (message.sender === "stop") {
    chrome.tabs.onUpdated.removeListener(activatedListener);
    chrome.tabs.onActivated.removeListener(updatedListener);
    chrome.runtime.reload();
  }
});

// function getYMDDate() {
//   let date = new Date();

//   let yyyy = date.getFullYear();
//   let mm = date.getMonth() + 1;
//   let dd = date.getDate();
//   let yyyymmdd = [
//     yyyy,
//     (mm > 9 ? "" : "0") + mm,
//     (dd > 9 ? "" : "0") + dd
//   ].join("");
//   return yyyymmdd;
// }

// xhr.onload = function () {
//   if (xhr.readyState === xhr.DONE) {
//     if (xhr.status === 200) {
//       let response = xhr.response;
//       if (response.includes("No Alert")) {
//         console.log("No alert");
//       } else {
//         console.log("Alert");
//       }
//     }
//     else {
//       console.log("Could not make a determination");
//     }
//   }
// };

// payload.windows[currTab.windowId].visits.forEach(visit => {
        //   let visitObj = payload.visits[visit];
        //   if (
        //     visitObj.url === currTab.url &&
        //     visitObj.chromeTabId === currTab.id
        //   ) {
        //     currNode = visitObj;
        //   }
        // });