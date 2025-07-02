const extractTiktokProfilePage = (request, sender, sendResponse) => {
  setTimeout(() => {
    const tiktokVideoListContainer = document.querySelector('[data-e2e="user-post-item-list"]');

    if (tiktokVideoListContainer) {
      let itemsProcessed = 0;
      let tiktokVids = [];
      let vidContainer = tiktokVideoListContainer.childNodes
      vidContainer.forEach((child, index, array) => {
        itemsProcessed++;
        
        // skip live video
        const liveAnchor = child.querySelector('[target="tiktok_live_view_window"]')
        if (liveAnchor) {
          return
        }

        const firstAnchor = child.querySelector('a');
        const videoCount = child.querySelector('strong.video-count')?.textContent || '';
        const hrefValue = firstAnchor.getAttribute('href') || '';
        const thumbnailUrl = child.querySelector('img')?.getAttribute('src') || '';
        tiktokVids.push({
          url: hrefValue,
          views: videoCount,
          thumbnailUrl: thumbnailUrl.includes('data:image/gif;base64') ? '' : thumbnailUrl
        })

        if (itemsProcessed === array.length) {
          // eslint-disable-next-line no-undef
          chrome.storage.local.set({ tiktokVids: tiktokVids.slice(0, 25) });
          sendResponse(tiktokVids)
        }
      });
    } else {
      console.log('Video list not found')
    }
  }, 4000);
}

const extractXProfilePage = (request, sender, sendResponse) => {
  const isRefresh = request.isRefresh
  let XData = {
    username: '',
    headerImg: '',
    profilePic: '',
    name: '',
    bio: '',
    following: '',
    followers: '',
    subscriptions: '',
    totalPost: '',
    userId: '',
    posts: []
  }
  const extractInteractionsData = (str) => {
    const splitData = str.split(',')
    let extractedData = {
      reply: 0,
      repost: 0,
      like: 0,
      bookmark: 0,
      view: 0,
    }
    for (let i = 0; i < splitData.length; i++) {
      const strData = splitData[i].trim()
      if (strData.includes('repl')) {
        extractedData.reply = parseInt(strData.split(' ')[0])
      }
      if (strData.includes('repost')) {
        extractedData.repost = parseInt(strData.split(' ')[0])
      }
      if (strData.includes('like')) {
        extractedData.like = parseInt(strData.split(' ')[0])
      }
      if (strData.includes('bookmark')) {
        extractedData.bookmark = parseInt(strData.split(' ')[0])
      }
      if (strData.includes('view')) {
        extractedData.view = parseInt(strData.split(' ')[0])
      }
    }
  
    return extractedData
  }
  const formatConnectionsNumber = (strData) => {
    if (typeof strData === 'string') {
      if (!strData) {
        return 0
      } else if (strData.includes(',')) {
        return parseInt(strData.replace(/,/g, ''), 10)
      } else if (strData.endsWith('K')) {
        return Math.round(parseFloat(strData) * 1000);
      } else if (strData.endsWith('M')) {
        return Math.round(parseFloat(strData) * 1000000);
      } else if (strData.endsWith('B')) {
        return Math.round(parseFloat(strData) * 1000000000);
      } else {
        return parseInt(strData, 10);
      }
    }
    return strData;
  }
  const getProfileHeaderData = () => {
    const parentEl = document.querySelector("[data-testid='primaryColumn']")
    const userNameContainerChilds = parentEl.querySelector("[data-testid='UserName']").querySelectorAll('span')
    const usernameFromEl = userNameContainerChilds[userNameContainerChilds.length - 1]?.innerText.split('@')[1] || ''
    XData.username = usernameFromEl
    XData.headerImg = parentEl.querySelector('a img').getAttribute('src') || ''
    XData.profilePic = parentEl.querySelector(`a[href='/${usernameFromEl}/photo'] img`).getAttribute('src') || ''
    XData.name = parentEl.querySelector("[data-testid='UserName']").querySelectorAll('span')[1].innerText || ''
    XData.bio = parentEl.querySelector("[data-testid='UserDescription']") ? parentEl.querySelector("[data-testid='UserDescription']").innerText : ''
    XData.following = parentEl.querySelector(`a[href='/${usernameFromEl}/following']`) ? parentEl.querySelector(`a[href='/${usernameFromEl}/following'] > span`).innerText : ''
    XData.following = formatConnectionsNumber(XData.following)
    XData.followers = parentEl.querySelector(`a[href='/${usernameFromEl}/verified_followers']`) ? parentEl.querySelector(`a[href='/${usernameFromEl}/verified_followers'] > span`).innerText : ''
    XData.followers = formatConnectionsNumber(XData.followers)
    XData.subscriptions = parentEl.querySelector(`a[href='/${usernameFromEl}/creator-subscriptions/subscriptions']`) ? parentEl.querySelector(`a[href='/${usernameFromEl}/creator-subscriptions/subscriptions'] > span`).innerText : ''
    XData.subscriptions = formatConnectionsNumber(XData.subscriptions)
    XData.totalPost = parentEl.querySelector('h2').parentElement.children[1] ? parentEl.querySelector('h2').parentElement.children[1].innerText : ''
    const extractedTotalPostNumber = XData.totalPost ? XData.totalPost.split(' ')[0] : ''
    XData.totalPost = formatConnectionsNumber(extractedTotalPostNumber)

    // extract userId from header img
    const regex = /profile_banners\/(\d+)\//;
    const match = XData.headerImg.match(regex);
    if (match && match[1]) {
      XData.userId = match[1]
    }  
  }
  const getProfilePosts = () => {
    const parentEl = document.querySelector("[data-testid='primaryColumn']")
    const postContainer = parentEl.querySelector(`[aria-label*='Timeline: '] > div`)

    if (postContainer) {
      let itemsProcessed = 0;
      let postData = [];
      let postChildren = postContainer.childNodes
      postChildren.forEach((child, index, array) => {
        itemsProcessed++;

        // skip if not a post
        const notAPost = !!child.querySelector("[data-testid='tweetText']")
        if (!notAPost) {
          return
        }

        const caption = child.querySelector("[data-testid='tweetText']") ? child.querySelector("[data-testid='tweetText']").innerText : ''
        const interactions = child.querySelector("[role='group']") ? child.querySelector("[role='group']").getAttribute('aria-label') : ''
        const url = child.querySelector('time') ? child.querySelector('time').parentElement.getAttribute('href') : ''
        const date = child.querySelector('time') ? child.querySelector('time').getAttribute('datetime') : ''
        const thumbnail = child.querySelector("[data-testid='tweetPhoto'] img")?.getAttribute('src') || '';
        
        // check repost
        let isRepost = false
        const repostText = child.querySelector("[data-testid='socialContext']")?.innerText || ''
        isRepost = repostText.includes('reposted') ? true : false

        // check pinned post
        let isPinnedPost = false
        if (index === 0) {
          const pinnedPostText = child.querySelector("[data-testid='socialContext']")?.innerText || ''
          isPinnedPost = pinnedPostText === 'Pinned' ? true : false
        }
        
        postData.push({
          caption,
          url,
          interactions: extractInteractionsData(interactions),
          isRepost,
          date,
          thumbnail,
          isPinnedPost
        })
      });

      return postData
    } else {
      console.log('Post list not found')
      return []
    }
  }
  const finalizePostData = (posts) => {
    // Remove duplicate data by checking the url value
    const unique = posts.reduce((acc, curr) => {
      if (!acc.some(item => item.url === curr.url)) {
        acc.push(curr);
      }
      return acc;
    }, []);
  
    return unique;
  }
  const areArraysEqualByURL = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
  
    // Extract and sort URLs from both arrays
    const urls1 = arr1.map(obj => obj.url).sort();
    const urls2 = arr2.map(obj => obj.url).sort();
  
    // Compare sorted URLs
    return urls1.every((url, index) => url === urls2[index]);
  };
  const saveFinalizedData = () => {
    XData.posts = finalizePostData(XData.posts)
    
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ XData: XData });
    sendResponse(XData)
  }
  const scrollToBottom = (isRefresh) => {
    let count = 0;
    let totalHeight = document.body.scrollHeight;
    let dividedHeight = 0;
    let currentHeight = 0;

    const scrollInterval = setInterval(() => {
      
      // this is done to get the same data every refresh (as long as user doesn't have new post)
      if (!isRefresh) {
        // if not refresh, go straight to bottom every time
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      } else {
        // if refresh, divide the previous total height by 3, and scroll by that height, and then increment the height
        dividedHeight = totalHeight / 3;
        currentHeight += dividedHeight
        window.scrollTo({ top: currentHeight, behavior: 'smooth' });
      }
      let newPostCollection = getProfilePosts()
      count++;

      // Stop at first scroll if user have no post
      if (count === 1 && !newPostCollection.length) {
        clearInterval(scrollInterval)
        saveFinalizedData()
      }
      
      // Stop at second scroll if user doesn't have any more posts
      if (count === 2) {
        const arePostArraysEqual = areArraysEqualByURL(XData.posts, newPostCollection)

        if (arePostArraysEqual) {
          clearInterval(scrollInterval)
          saveFinalizedData()
        }
      }

      XData.posts = [
        ...XData.posts,
        ...newPostCollection
      ]

      // Stop at third scroll and finalize the appended post data by filtering data with same URL
      if (count >= 3) {
        clearInterval(scrollInterval);
        saveFinalizedData()
      }
    }, 2500);     
  }

  setTimeout(() => {
    // Scroll to top in case of extension is triggered to refresh the data
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Initially get the header data (name, username, bio, etc). Then collect the posts
    getProfileHeaderData()
    scrollToBottom(isRefresh)
  }, 2000);
}

const extractXSuggestedUsersPage = (request, sender, sendResponse) => {
  const getSuggestedUsers = () => {
    let suggestedUsersData = {
      username: '',
      isElementAvailable: false,
      users: []
    }
    const parentEl = document.querySelector("[data-testid='primaryColumn']")
    const postContainer = parentEl.querySelector(`[aria-label='Timeline: Connect'] > div`)
    let isFollowHeadingAvailable = postContainer.querySelector('h2').innerText === 'Follow'

    if (postContainer && isFollowHeadingAvailable) {
      suggestedUsersData.isElementAvailable = true;

      let userData = [];
      let foundFollowHeading = false;
      let foundSuggestedUsersHeading = false;
      let foundSuggestedForYouHeading = false;

      let postChildren = postContainer.childNodes
      const traverse = (postArr) => {
        // Stop if the "Suggested for you" heading is found
        if (foundSuggestedForYouHeading) return;

        for (let i = 0; i < postArr.length; i++) {
          const child = postArr[i];
          // Check if this element or any descendant contains the target h2 elements
          const h2 = child.tagName.toLowerCase() === 'h2' ? child : child.querySelector('h2');
          
          if (h2) {
            if (!foundFollowHeading && h2.innerText.includes('Follow')) {
              suggestedUsersData.username = postArr[i + 1].querySelector('a[role="link"]')?.getAttribute('href')?.split('/')[1] || '';
              foundFollowHeading = true;
            } else if (!foundSuggestedUsersHeading && h2.innerText.includes('Similar to')) {
              foundSuggestedUsersHeading = true;
            } else if (foundSuggestedUsersHeading && !foundSuggestedForYouHeading && h2.innerText.includes('Suggested for you')) {
              
              foundSuggestedForYouHeading = true;
              const filterEmptyUserData = userData.filter((item) => !!item.username)
              suggestedUsersData.users.push(...filterEmptyUserData)
              // eslint-disable-next-line no-undef
              chrome.storage.local.set({ XSuggestedUsersData: suggestedUsersData });
              sendResponse('resp')
              break; // Stop processing further
            }
          } else if (foundSuggestedUsersHeading && !foundSuggestedForYouHeading) {
            const tempUsername = child.querySelector('a[role="link"]')?.getAttribute('href')?.split('/')[1] || ''
            const tempName = child.querySelectorAll('a[role="link"]')[1]?.innerText || ''
            const tempAvatar = child.querySelector('img')?.getAttribute('src') || ''

            if (!tempUsername && !tempName && !tempAvatar) {
              // check if the element is the separator which contains no data, and skip the process
              continue
            } else {
              userData.push({
                username: tempUsername,
                name: tempName,
                avatar: tempAvatar,
              });  
            }
          }
          // Continue traversal for the child element
          traverse(child);
        }
      }

      traverse(postChildren);
    } else {
      console.log('Suggested users list not found')
      // eslint-disable-next-line no-undef
      chrome.storage.local.set({ XSuggestedUsersData: {
        isElementAvailable: false,
      } });
    }
  }

  setTimeout(() => {
    getSuggestedUsers()
  }, 2000);
}

const extractLinkedinCompanyIndex = (request, sender, sendResponse) => {
  setTimeout(() => {
    const baseData = scrapeLinkedinBaseData()
    const linkedinCompanyIndex = {
      ...baseData,
    }
    let itemsProcessed = 0;
    let companyPosts = [];
    const companyInitialPosts = document.getElementsByClassName('artdeco-carousel__slider')[0]
    const liElements = companyInitialPosts.querySelectorAll('.artdeco-carousel__item');
    const liArray = Array.from(liElements);

    liArray.forEach((child, index, array) => {
      itemsProcessed++;
      const postCaption = child.getElementsByClassName('update-components-update-v2__commentary')[0] ? child.getElementsByClassName('update-components-update-v2__commentary')[0].innerText : '';
      const reactions = child.querySelector('.social-details-social-counts__reactions-count') ? child.querySelector('.social-details-social-counts__reactions-count').innerText : '';
      const postResponse = child.querySelector('ul');
      const checkResponseType = (selector, text) => {
        let elements = postResponse.querySelectorAll(selector);
        return Array.prototype.filter.call(elements, function(element){
          return RegExp(text).test(element.textContent);
        });
      }
      // const comments = postResponse ? checkResponseType('span', 'comment')[0].innerText : ''
      // const reposts = postResponse ? checkResponseType('span', 'repost')[0].innerText : ''
      const commentsEl = postResponse ? checkResponseType('span', 'comment') : ''
      const repostsEl = postResponse ? checkResponseType('span', 'repost') : ''

      companyPosts.push({
        caption: postCaption,
        reactions: reactions,
        comments: commentsEl && commentsEl.length ? commentsEl[0].innerText : '',
        reposts: repostsEl && repostsEl.length ? repostsEl[0].innerText : ''
      })

      if (itemsProcessed === array.length) {
        // eslint-disable-next-line no-undef
        // chrome.storage.local.set({ tiktokVids: tiktokVids });
        // sendResponse(postCaption)
        linkedinCompanyIndex.posts = companyPosts
      }
    });

    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ linkedinCompanyIndex: linkedinCompanyIndex });
    sendResponse(linkedinCompanyIndex)

  }, 2000);
}

const extractLinkedinCompanyAbout = (request, sender, sendResponse) => {
  setTimeout(() => {
    const baseData = scrapeLinkedinBaseData()

    const companyAboutData = document.getElementsByClassName('org-page-details-module__card-spacing')[0]

    const overview = companyAboutData.querySelectorAll('p')[0].innerText

    function extractData() {
      const dataContainer = companyAboutData.querySelectorAll('dl')[0]
      const data = {};
    
      // Extract website
      const websiteElement = dataContainer.querySelector('dd a[href^="http"] span');
      data.website = websiteElement ? websiteElement.textContent.trim() : null;
    
      // Extract phone
      const phoneElement = dataContainer.querySelector('dd a[href^="tel"] span[aria-hidden="true"]');
      data.phone = phoneElement ? phoneElement.textContent.trim() : null;
    
      // Extract industry
      // const industryElement = dataContainer.querySelector('dt:contains("Industry") + dd');
      // data.industry = industryElement ? industryElement.textContent.trim() : null;
    
      // Extract company size
      // const companySizeElement = dataContainer.querySelector('dt:contains("Company size") + dd');
      // data.companySize = companySizeElement ? companySizeElement.textContent.trim() : null;
    
      // Extract founded year
      // const foundedElement = dataContainer.querySelector('dt:contains("Founded") + dd');
      // data.founded = foundedElement ? foundedElement.textContent.trim() : null;
    
      return data;
    }
    const aboutData = extractData()

    const linkedinCompanyAbout = {
      ...baseData,
      overview,
      ...aboutData
    }
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ linkedinCompanyAbout: linkedinCompanyAbout });
    sendResponse(linkedinCompanyAbout)

    // if (linkedin) {
    // } else {
    // }
  }, 2000);
}

const extractLinkedinCompanyPost = (request, sender, sendResponse) => {
  const baseData = scrapeLinkedinBaseData()
  const linkedinCompanyPost = {
    ...baseData,
    posts: [],
  }

  const getProfilePosts = () => {
    let itemsProcessed = 0;
    let companyPosts = [];
    const companyPostData = document.getElementsByClassName('scaffold-finite-scroll__content')[0]
    const postElements = companyPostData.children;
    const postElArray = Array.from(postElements);

    postElArray.forEach((child, index, array) => {
      itemsProcessed++;
      const postCaption = child.getElementsByClassName('update-components-update-v2__commentary')[0] ? child.getElementsByClassName('update-components-update-v2__commentary')[0].innerText : '';
      const reactions = child.querySelector('.social-details-social-counts__reactions') ? child.querySelector('.social-details-social-counts__reactions').innerText : '';
      const formattedReactions = (reactionsActualData) => {
        let reactionsTotal = ''

        if (reactionsActualData) { 
          if (reactions.includes('\n')) {
            reactionsTotal = reactions.split('\n')[0]
          } else {
            reactionsTotal = reactionsActualData
          }
        } else {
          reactionsTotal = ''
        }

        return reactionsTotal
      }
      const postResponse = child.querySelectorAll('ul.display-flex')[0];
      const checkResponseType = (selector, text) => {
        let elements = postResponse.querySelectorAll(selector);
        return Array.prototype.filter.call(elements, function(element){
          return RegExp(text).test(element.textContent);
        });
      }
      const commentsEl = postResponse ? checkResponseType('span', 'comment') : ''
      const repostsEl = postResponse ? checkResponseType('span', 'repost') : ''

      companyPosts.push({
        caption: postCaption,
        reactions: formattedReactions(reactions),
        comments: commentsEl && commentsEl.length ? commentsEl[0].innerText : '',
        reposts: repostsEl && repostsEl.length ? repostsEl[0].innerText : ''
      })

      if (itemsProcessed === array.length) {
        // eslint-disable-next-line no-undef
        // chrome.storage.local.set({ tiktokVids: tiktokVids });
        // sendResponse(postCaption)
        linkedinCompanyPost.posts.push(...companyPosts)
      }
    });
  }
  const scrollToBottom = () => {
    let count = 0;

    const scrollInterval = setInterval(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      getProfilePosts()
      count++;

      // Stop at third scroll and finalize the appended post data by filtering data with same URL
      if (count >= 3) {
        clearInterval(scrollInterval);
        // linkedinCompanyPost.posts = finalizePostData(linkedinCompanyPost.posts)

        // eslint-disable-next-line no-undef
        chrome.storage.local.set({ linkedinCompanyPost: linkedinCompanyPost });
        sendResponse(linkedinCompanyPost)
      }
    }, 2500);     
  }

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    scrollToBottom()
  }, 2000);
}

const extractLinkedinCompanyPeople = (request, sender, sendResponse) => {
  setTimeout(() => {
    const baseData = scrapeLinkedinBaseData()

    const linkedinCompanyPeople = {
      ...baseData,
    }

    let itemsProcessed = 0;
    let peopleData = [];
    const peopleContainer = document.getElementsByClassName('scaffold-finite-scroll__content')[0]
    const peopleList = peopleContainer.querySelector('ul').querySelectorAll('li')
    const peopleArray = Array.from(peopleList)

    peopleArray.forEach((child, index, array) => {
      itemsProcessed++;
      const profilePict = child.querySelectorAll('img')[1].src;
      const url = child.querySelector('.artdeco-entity-lockup__title').querySelector('a').href
      const name = child.querySelector('.artdeco-entity-lockup__title').innerText
      const role = child.querySelector('.artdeco-entity-lockup__subtitle').innerText

      peopleData.push({
        profilePicture: profilePict,
        url,
        name,
        role
      })

      if (itemsProcessed === array.length) {
        // eslint-disable-next-line no-undef
        // chrome.storage.local.set({ tiktokVids: tiktokVids });
        // sendResponse(postCaption)
        linkedinCompanyPeople.people = peopleData
      }

    });

    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ linkedinCompanyPeople: linkedinCompanyPeople });
    sendResponse(linkedinCompanyPeople)

    // if (linkedin) {
    // } else {
    // }
  }, 2000);
}

const extractLinkedinProfile = (request, sender, sendResponse) => {
  setTimeout(() => {
    let profileData = {}

    const profileSummaryContainer = document.querySelector('.ph5')
    const findAbout = () => {
      const aboutIdEl = document.querySelector('#about')

      if (!aboutIdEl) {
        return ''
      } else {
        const aboutParentEl = aboutIdEl.parentElement
        const aboutText = aboutParentEl.querySelectorAll('span[aria-hidden="true"]')[1].innerText
        return aboutText
      }
    }
    const findExperience = () => {
      const experienceIdEl = document.querySelector('#experience')

      if (!experienceIdEl) {
        return []
      } else {
        let itemsProcessed = 0;
        let profileExp = [];
        const experienceParentEl = experienceIdEl.parentElement
        const experienceContainer = experienceParentEl.querySelector('ul').children
        const experienceArr = Array.from(experienceContainer)

        experienceArr.forEach((child, index, array) => {
          itemsProcessed++;
          const info = child.querySelector('.display-flex.flex-wrap.align-items-center.full-height').innerText.split('\n')[0]

          profileExp.push({
            info
          })
  
          // if (itemsProcessed === array.length) {
          //   // eslint-disable-next-line no-undef
          //   // chrome.storage.local.set({ tiktokVids: tiktokVids });
          //   // sendResponse(postCaption)
          //   linkedinCompanyIndex.posts = companyPosts
          // }
        });
        return profileExp
      }
    }
    const findEducation = () => {
      const educationIdEl = document.querySelector('#education')

      if (!educationIdEl) {
        return []
      } else {
        let profileEducation = [];
        const educationParentEl = educationIdEl.parentElement
        const educationContainer = educationParentEl.querySelector('ul').children
        const educationArr = Array.from(educationContainer)

        educationArr.forEach((child, index, array) => {
          const educationDetail = child.querySelector('a.optional-action-target-wrapper.display-flex.flex-column.full-width').children[0].innerText.split('\n')[0]

          profileEducation.push({
            school: educationDetail
          })
        });
        return profileEducation
      }
    }
    const findSkills = () => {
      const skillsIdEl = document.querySelector('#education')

      if (!skillsIdEl) {
        return []
      } else {
        let profileEducation = [];
        const educationParentEl = skillsIdEl.parentElement
        const educationContainer = educationParentEl.querySelector('ul').children
        const educationArr = Array.from(educationContainer)

        educationArr.forEach((child, index, array) => {
          const educationDetail = child.querySelector('a.optional-action-target-wrapper.display-flex.flex-column.full-width').children[0].innerText.split('\n')[0]

          profileEducation.push({
            school: educationDetail
          })
        });
        return profileEducation
      }
    }
    const checkAudienceType = (strValue) => {
      if (strValue.includes('connection')) {
        return 'connection'
      }
    
      if (strValue.includes('follower')) {
        return 'follower'
      }
    
      return false
    }
    const checkConnectionStrContent = (strValue) => {
      if (strValue.includes('+')) {
        return parseInt(strValue.split('+')[0])
      } else {
        return parseInt(strValue)
      }
    }
    const extractProfileAudience = () => {
      const elContainer = document.querySelector('.ph5').querySelectorAll('ul > li.text-body-small')
      let result = {
        follower: null,
        connection: null
      }
    
      if (elContainer && elContainer.length) {
        if (elContainer.length === 1) {
          let stringContent = elContainer[0].innerText
          let audienceType = checkAudienceType(stringContent)
          
          if (audienceType === 'connection') {
            result.connection = checkConnectionStrContent(stringContent.split(' connection')[0])
          } else {
            result.follower = parseInt(stringContent.split(' follower')[0].replace(/,/g, ''), 10)
          }
        } else if (elContainer.length === 2) {
          let followerStringContent = elContainer[0].innerText
          let connectionStringContent = elContainer[1].innerText
    
          result.follower = parseInt(followerStringContent.split(' follower')[0].replace(/,/g, ''), 10)
          result.connection = checkConnectionStrContent(connectionStringContent.split(' connection')[0])
        }
      }
    
      
      if (result.follower !== null && result.connection !== null) {
        if (result.follower < result.connection) {
          return Math.min(result.follower, result.connection)
        }
    
        if (result.follower >= result.connection) {
          return result.follower - result.connection
        }
      } else if (result.follower === null && result.connection !== null) {
        return result.connection
      } else if (result.follower !== null && result.connection === null) {
        return result.follower
      }
    }

    profileData.profilePict = profileSummaryContainer.querySelector('.pv-top-card-profile-picture__image--show') ? profileSummaryContainer.querySelector('.pv-top-card-profile-picture__image--show').src : ''
    profileData.name = profileSummaryContainer.querySelector('h1.text-heading-xlarge') ? profileSummaryContainer.querySelector('h1.text-heading-xlarge').innerText : ''
    profileData.bio = profileSummaryContainer.querySelector('.text-body-medium.break-words') ? profileSummaryContainer.querySelector('.text-body-medium.break-words').innerText : ''
    profileData.location = profileSummaryContainer.querySelectorAll('span.text-body-small') ? profileSummaryContainer.querySelectorAll('span.text-body-small')[2].innerText : ''
    profileData.location = profileSummaryContainer.querySelector('div.mt2.relative').lastElementChild.querySelector('span') ? profileSummaryContainer.querySelector('div.mt2.relative').lastElementChild.querySelector('span').innerText : ''
    profileData.isPremiumMember = Boolean(profileSummaryContainer.querySelector('span.pv-member-badge'))
    profileData.isVerifiedProfile = Boolean(profileSummaryContainer.querySelector('span.pv-text-details__verification-badge'))
    profileData.website = profileSummaryContainer.querySelector('.pv-top-card--website') ? profileSummaryContainer.querySelector('.pv-top-card--website').querySelector('a').href : ''
    profileData.connectionFollowers = extractProfileAudience() || 0
    profileData.about = findAbout()
    profileData.experience = findExperience()
    profileData.education = findEducation()

    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ profileFollowers : { username: request.username, connectionFollowers: profileData.connectionFollowers } });
  }, 2000);
}

const extractLinkedinProfileActivity = (request, sender, sendResponse) => {
  const isRefresh = request.isRefresh
  let profileActivityData = {
    username: '',
    profilePic: '',
    name: '',
    bio: '',
    followers: null,
    posts: [],
    suggestedUsers: []
  }
  const getProfileData = () => {
    const parentEl = document.querySelector("#recent-activity-top-card")
    profileActivityData.profilePic = parentEl.querySelector('img')?.getAttribute('src') || ''
    profileActivityData.name = parentEl.querySelector('h3')?.innerText || ''
    profileActivityData.bio = parentEl.querySelector('h4')?.innerText || ''
    profileActivityData.followers = parentEl.querySelector('.pt4.pb4')?.querySelector('div > div:nth-of-type(2)')?.innerText ? parseInt(parentEl.querySelector('.pt4.pb4')?.querySelector('div > div:nth-of-type(2)')?.innerText.replace(/,/g, ''), 10) : null 
    
  }
  const getSuggestedUsers = () => {
    let itemsProcessed = 0;
    let suggestedUsers = [];
    const parentEl = document.querySelector('.pv-profile-card');
    const suggestedUsersContainer = parentEl.children[2].querySelector('ul')
    const suggestedUsersArr = Array.from(suggestedUsersContainer.children)

    suggestedUsersArr.forEach((child, index, array) => {
      itemsProcessed++;
      const profilePic = child.querySelector('img')?.getAttribute('src') || ''
      const name = child.querySelectorAll('a')[1]?.querySelector('span')?.innerText || ''
      const bio = child.querySelectorAll('a')[1]?.querySelector('div:nth-of-type(2)')?.querySelector('span')?.innerText || ''
      const username = child.querySelector('a')?.getAttribute('href')?.split('/in/')[1] || ''
      const url = child.querySelector('a')?.getAttribute('href') || ''

      suggestedUsers.push({
        profilePic,
        name,
        bio,
        username,
        url,
      })

      if (itemsProcessed === array.length) {
        profileActivityData.suggestedUsers.push(...suggestedUsers)
      }
    });
  }
  const removeEmptyData = (posts) => {
    // Remove empty data
    const finalDataset = posts.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const getProfilePosts = () => {
    const companyPostData = document.querySelector('.scaffold-finite-scroll__content')
    const postElements = companyPostData.children[1];
    const postElArray = Array.from(postElements.children);

    if (postElArray) {
      let profilePost = [];
      postElArray.forEach((child, index, array) => {
        const postCaption = child.getElementsByClassName('update-components-update-v2__commentary')[0] ? child.getElementsByClassName('update-components-update-v2__commentary')[0].innerText : '';
        const reactions = child.querySelector('.social-details-social-counts__reactions') ? child.querySelector('.social-details-social-counts__reactions').innerText : '';
        const formattedReactions = (reactionsActualData) => {
          let reactionsTotal = ''
  
          if (reactionsActualData) { 
            if (reactions.includes('\n')) {
              reactionsTotal = reactions.split('\n')[0]
            } else {
              reactionsTotal = reactionsActualData
            }
          } else {
            reactionsTotal = 0
          }
  
          return parseInt(reactionsTotal)
        }
        const postResponse = child.querySelectorAll('ul.display-flex')[0];
        const checkResponseType = (selector, text) => {
          let elements = postResponse.querySelectorAll(selector);
          return Array.prototype.filter.call(elements, function(element){
            return RegExp(text).test(element.textContent);
          });
        }
        const commentsEl = postResponse ? checkResponseType('span', 'comment') : ''
        const repostsEl = postResponse ? checkResponseType('span', 'repost') : ''
        const postUrn = child.querySelector('.feed-shared-update-v2')?.getAttribute('data-urn') || ''
        const postUrl = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : ''
        const postDate = child.querySelector('.update-components-actor__sub-description')?.querySelector('span')?.innerText || ''
        const formattedPostDate = postDate ? postDate.split(' • ')[0] : ''
        const thumbnailUrl = child.querySelector('.update-components-image')?.querySelector('img')?.getAttribute('src') || ''
        const isRepost = child.querySelector('.update-components-header--with-divider') ? true : false
  
        profilePost.push({
          caption: postCaption,
          reactions: formattedReactions(reactions),
          comments: commentsEl && commentsEl.length ? parseInt(commentsEl[0].innerText) : 0,
          reposts: repostsEl && repostsEl.length ? parseInt(repostsEl[0].innerText) : 0,
          url: postUrl,
          estimatedDate: formattedPostDate,
          thumbnailUrl,
          isRepost
        })
      });

      const cleanPosts = removeEmptyData(profilePost)

      return cleanPosts
    } else {
      console.log('Post list not found')
      return []
    }
  }
  const finalizePostData = (posts) => {
    // Remove duplicate data by checking the url value
    const uniqueData = posts.reduce((acc, curr) => {
      if (!acc.some(item => item.url === curr.url)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    // Remove empty data
    const finalDataset = uniqueData.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const saveFinalizedData = () => {
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ linkedinProfileActivityData : profileActivityData });
    sendResponse(profileActivityData)
  }
  const areArraysEqualByURL = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
  
    // Extract and sort URLs from both arrays
    const urls1 = arr1.map(obj => obj.url).sort();
    const urls2 = arr2.map(obj => obj.url).sort();
  
    // Compare sorted URLs
    return urls1.every((url, index) => url === urls2[index]);
  };
  const scrollToBottom = (isRefresh) => {
    let count = 0;
    let totalHeight = document.body.scrollHeight;
    let newPostsCollection
    
    const scrollInterval = setInterval(() => {
      
      // this is done to get the same data every refresh (as long as user doesn't have new post)
      if (!isRefresh) {
        // if not refresh, go straight to bottom every time
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        newPostsCollection = getProfilePosts()

        count++
      } else {
        // if refresh, divide the previous total height by 3, and scroll by that height, and then increment the height
        window.scrollTo({ top: totalHeight, behavior: 'smooth' });
        newPostsCollection = getProfilePosts()
        

        profileActivityData.posts = finalizePostData([
          ...profileActivityData.posts,
          ...newPostsCollection
        ])

        clearInterval(scrollInterval)
        saveFinalizedData()
      }

      // Stop at first scroll if user have no post
      if (count === 1 && !newPostsCollection.length) {
        clearInterval(scrollInterval)
        saveFinalizedData()
      }
      
      // Stop scroll if user doesn't have any more posts
      if (count >= 2) {
        const arePostArraysEqual = areArraysEqualByURL(profileActivityData.posts, newPostsCollection)

        if (arePostArraysEqual) {
          clearInterval(scrollInterval)
          saveFinalizedData()
        }
      }

      profileActivityData.posts = finalizePostData([
        ...profileActivityData.posts,
        ...newPostsCollection
      ])

      // Stop at third scroll and finalize the appended post data by filtering data with same URL
      if (count >= 3) {
        clearInterval(scrollInterval);
        saveFinalizedData()
      }
    }, 2500);     
  }

  setTimeout(() => {
    // Scroll to top in case of extension is triggered to refresh the data
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Initially get the header data (name, username, bio, etc). Then collect the posts
    getProfileData()
    getSuggestedUsers()
    scrollToBottom(isRefresh)
  }, 2000);
}

const autoToggleExtBtn = () => {
  const toggleButton = document.querySelector('#mezink-ext-btn')

  if (toggleButton.classList.contains("mezink-button-expanded")) {
    toggleButton.click()
  }
}

const extractFacebookGroup = (request, sender, sendResponse) => {
  setTimeout(() => {
    const facebookPostContainer = document.querySelector('[role="feed"]');
    const extractValuesFromPost = (text) => {
      let profileName = '';
      let datePosted = '';
      let reactions = '';
      let commentCount = '';

      if (text) {            
        const lines = text.split('\n').filter(line => line.trim() !== '');
        profileName = lines[0].trim();
        // datePosted = lines[1].trim();
        datePosted = '';
      
        const allReactionsIndex = lines.findIndex(line => line.includes('All reactions:'));
        if (allReactionsIndex !== -1) {
          reactions = lines[allReactionsIndex + 1].trim();
        }
      
        const commentCountIndex = lines.findIndex(line => /^\d+ comments$/.test(line.trim()));
        if (commentCountIndex !== -1 && lines[commentCountIndex + 1].trim() === 'Like') {
          commentCount = lines[commentCountIndex].trim().split(' ')[0];
        }
      }
    
      return {
        profileName: profileName,
        datePosted: datePosted,
        reactions: reactions,
        commentCount: commentCount
      };
    }
    const extractProfileId = (url) => {
      if (url.includes('/user/')) {
        let splitUserPath = url.split('/user/')[1]
        let userId = splitUserPath.split('/')[0]
        return userId
      } else {
        return ''
      }
    }

    if (facebookPostContainer) {
      let itemsProcessed = 0;
      let facebookPosts = [];
      let postContainer = facebookPostContainer.childNodes
      postContainer.forEach((child, index, array) => {
        itemsProcessed++;
        let profileId = ''
        const postHref = child.querySelectorAll('a[href]')
        if (postHref && postHref.length) {
          let urls = Array.from(postHref).map(element => element.href)
          profileId = extractProfileId(urls[0])
        }

        const elementTextData = child.outerText
        const facebookPostData = extractValuesFromPost(elementTextData)
        facebookPosts.push({
          profileUrl: profileId ? `https://web.facebook.com/${profileId}` : '',
          ...facebookPostData
        })

        if (itemsProcessed === array.length) {
          // eslint-disable-next-line no-undef
          chrome.storage.local.set({ facebookPosts: facebookPosts });
          sendResponse(facebookPosts)
        }
      })
    } else {
      console.log('Video list not found')
    }
  }, 2000);
}

const extractFacebookPage = (request, sender, sendResponse) => {
  setTimeout(() => {
    const facebookPostContainer = document.querySelectorAll('[aria-posinset]');
    const extractValuesFromPost = (text) => {
      let profileName = '';
      let datePosted = '';
      let reactions = '';
      let commentCount = '';
      let shareCount = '';

      if (text) {            
        const lines = text.split('\n').filter(line => line.trim() !== '');
        profileName = lines[0].trim();
        // datePosted = lines[1].trim();
        datePosted = '';
      
        const allReactionsIndex = lines.findIndex(line => line.includes('All reactions:'));
        if (allReactionsIndex !== -1) {
          reactions = lines[allReactionsIndex + 1].trim();
        }
      
        const commentCountIndex = lines.findIndex(line => /^\d+ comments$/.test(line.trim()));
        if (commentCountIndex !== -1) {
          commentCount = lines[commentCountIndex].trim().split(' ')[0];
        }
      
        const shareCountIndex = lines.findIndex(line => /^\d+ shares$/.test(line.trim()));
        if (shareCountIndex !== -1) {
          shareCount = lines[shareCountIndex].trim().split(' ')[0];
        }
      }
    
      return {
        profileName: profileName,
        datePosted: datePosted,
        reactions: reactions,
        commentCount: commentCount,
        shareCount: shareCount,
      };
    }
    // const extractProfileId = (url) => {
    //   if (url.includes('/user/')) {
    //     let splitUserPath = url.split('/user/')[1]
    //     let userId = splitUserPath.split('/')[0]
    //     return userId
    //   } else {
    //     return ''
    //   }
    // }

    if (facebookPostContainer) {
      let itemsProcessed = 0;
      let facebookPosts = [];
      facebookPostContainer.forEach((child, index, array) => {
        itemsProcessed++;
        // let profileId = ''
        // const postHref = child.querySelectorAll('a[href]')
        // if (postHref && postHref.length) {
        //   let urls = Array.from(postHref).map(element => element.href)
        //   profileId = extractProfileId(urls[0])
        // }

        const elementTextData = child.outerText
        const facebookPostData = extractValuesFromPost(elementTextData)
        facebookPosts.push({
          // profileUrl: profileId ? `https://web.facebook.com/${profileId}` : '',
          ...facebookPostData
        })

        if (itemsProcessed === array.length) {
          // eslint-disable-next-line no-undef
          chrome.storage.local.set({ facebookPosts: facebookPosts });
          sendResponse(facebookPosts)
        }
      })
    } else {
      console.log('Video list not found')
    }
  }, 2000);
}

const extractFacebookReel = (request, sender, sendResponse) => {
  setTimeout(() => {
    let facebookReel = {}

    const reelParentEl = document.querySelector('div[role="main"]')

    facebookReel.profilePic = reelParentEl.querySelectorAll('a[aria-label="See Owner Profile"')[0].querySelector('image').getAttribute('xlink:href') || ''
    facebookReel.name = reelParentEl.querySelectorAll('a[aria-label="See Owner Profile"')[1] ? reelParentEl.querySelectorAll('a[aria-label="See Owner Profile"')[1].innerText : ''
    facebookReel.profileUrl = reelParentEl.querySelectorAll('a[aria-label="See Owner Profile"')[1].getAttribute('href') || ''
    facebookReel.truncatedCaption = reelParentEl.children[0].children[0].children[0].children[1].querySelector('span[dir="auto"]').querySelector('div').childNodes[0].textContent || ''
    facebookReel.likes = reelParentEl.children[0].children[0].children[0].children[1].children[1].innerText.split('\n')[0] || ''
    facebookReel.comments = reelParentEl.children[0].children[0].children[0].children[1].children[1].innerText.split('\n')[1] || ''
    facebookReel.shares = reelParentEl.children[0].children[0].children[0].children[1].children[1].innerText.split('\n')[2] || ''
  }, 2000);
}

const extractFacebookReels = (request, sender, sendResponse) => {
  const isRefresh = request.isRefresh
  let profileData = {
    name: '',
    profilePicture: '',
    isVerified: false,
    totalLikes: 0,
    totalFollowers: 0,
    totalFollowing: 0,
    reels: []
  }

  const formatNumbers = (numberVal) => {
    if (typeof numberVal === 'string') {
      if (numberVal.endsWith('K')) {
        return Math.round(parseFloat(numberVal) * 1000);
      } else if (numberVal.endsWith('M')) {
        return Math.round(parseFloat(numberVal) * 1000000);
      } else if (numberVal.endsWith('B')) {
        return Math.round(parseFloat(numberVal) * 1000000000);
      } else {
        return parseInt(numberVal, 10);
      }
    }

    return numberVal
  }
  const getHeaderData = () => {
    const reelsParentEl = document.querySelector('div[role="main"]')
    profileData.name = reelsParentEl.querySelector('h1')?.innerText?.trim() || ''
    profileData.profilePicture = reelsParentEl.querySelector('image')?.getAttribute('xlink:href') || ''
    profileData.isVerified = reelsParentEl.querySelector('svg[title="Verified account"]') ? true : false

    if (profileData.isVerified && profileData.name) {
      const checkProfileDynamicData = () => {
        let dataContainer = reelsParentEl.querySelectorAll('a[role="link"][tabindex="0"]') && reelsParentEl.querySelectorAll('a[role="link"][tabindex="0"]').length ? reelsParentEl.querySelectorAll('a[role="link"][tabindex="0"]')[1]?.parentElement?.parentElement?.nextElementSibling?.nextElementSibling?.querySelectorAll('span')[4].querySelectorAll('a') : []

        if (dataContainer && dataContainer.length) {
          dataContainer.forEach(anchor => {
            const text = anchor.innerText;
            const numberValue = text.split(' ')[0]
        
            if (text.includes('like')) {
              profileData.totalLikes = formatNumbers(numberValue);
            } else if (text.includes('follower')) {
              profileData.totalFollowers = formatNumbers(numberValue);
            } else if (text.includes('following')) {
              profileData.totalFollowing = formatNumbers(numberValue);
            }
          });
        }
      }
      checkProfileDynamicData()
    } else if (!profileData.isVerified && profileData.name) {
      const checkProfileDynamicData = () => {
        let dataContainer = reelsParentEl.querySelector(`svg[aria-label="${profileData.name}"]`).parentElement.parentElement.parentElement.parentElement.nextElementSibling.nextElementSibling.querySelectorAll('span')[2].querySelectorAll('a')

        dataContainer.forEach(anchor => {
          const text = anchor.innerText;
          const numberValue = text.split(' ')[0]
      
          if (text.includes('like')) {
            profileData.totalLikes = formatNumbers(numberValue);
          } else if (text.includes('follower')) {
            profileData.totalFollowers = formatNumbers(numberValue);
          } else if (text.includes('following')) {
            profileData.totalFollowing = formatNumbers(numberValue);
          }
        });
      }
      checkProfileDynamicData()

    }
  }
  const finalizePostData = (posts) => {
    // Remove duplicate data by checking the reel mediaId value
    const uniqueData = posts.reduce((acc, curr) => {
      if (!acc.some(item => item.mediaId === curr.mediaId)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    return uniqueData
  }
  const removeEmptyData = (posts) => {
    // Remove empty data
    const finalDataset = posts.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const areArraysEqualByURL = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
  
    // Extract and sort URLs from both arrays
    const urls1 = arr1.map(obj => obj.reelsUrl).sort();
    const urls2 = arr2.map(obj => obj.reelsUrl).sort();
  
    // Compare sorted URLs
    return urls1.every((url, index) => url === urls2[index]);
  };
  const getReelsData = () => {
    const reelsParentEl = document.querySelector('div[role="main"]')
    let reelsContainer = reelsParentEl.querySelectorAll('[role="tablist"]')[1].parentElement.parentElement.nextElementSibling.children[0]

    if (reelsContainer) {
      let tempReels = []
      const reelsNodes = reelsContainer.childNodes

      reelsNodes.forEach((child, index, array) => {
        let reelsUrl = child.querySelector('a') ? `https://web.facebook.com${child.querySelector('a').getAttribute('href')}` : ''
        let thumbnail = child.querySelector('img') ? child.querySelector('img').getAttribute('src') : ''
        let views = child.innerText || ''
        const splitReelUrl = reelsUrl.split('/')
        const mediaId = splitReelUrl[4] || ''

        const formatViews = (viewsNumber) => {
          if (typeof viewsNumber === 'string') {
            if (viewsNumber.endsWith('K')) {
              return Math.round(parseFloat(viewsNumber) * 1000);
            } else if (viewsNumber.endsWith('M')) {
              return Math.round(parseFloat(viewsNumber) * 1000000);
            } else if (viewsNumber.endsWith('B')) {
              return Math.round(parseFloat(viewsNumber) * 1000000000);
            } else {
              return parseInt(viewsNumber, 10);
            }
          }

          return viewsNumber
        }

        tempReels.push({
          reelsUrl,
          thumbnail,
          views: views ? formatViews(views) : '',
          mediaId
        })
      })

      const cleanReels = removeEmptyData(tempReels)
      
      return cleanReels
    } else {
      console.log('Reels list not found')
      return []
    }
  }
  const saveFinalizedData = () => {
    // profileData.reels = finalizePostData(profileData.reels)
    
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ facebookReels: profileData });
    sendResponse(profileData)
  }
  const scrollToBottom = () => {
    let count = 0;
    let totalHeight = document.body.scrollHeight;
    let newReelsCollection

    const scrollInterval = setInterval(() => {
      
      // this is done to get the same data every refresh (as long as user doesn't have new post)
      if (!isRefresh) {
        // if not refresh, go straight to bottom every time
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        newReelsCollection = getReelsData()
        count++;
      } else {
        // if refresh, divide the previous total height by 3, and scroll by that height, and then increment the height
        window.scrollTo({ top: totalHeight, behavior: 'smooth' });
        newReelsCollection = getReelsData()

        profileData.reels = finalizePostData([
          ...profileData.reels,
          ...newReelsCollection
        ])
        
        clearInterval(scrollInterval);
        saveFinalizedData()
      }

      // Stop at first scroll if user have no post
      if (count === 1 && !newReelsCollection.length) {
        clearInterval(scrollInterval)
        saveFinalizedData()
      }
      
      // Stop scroll if user doesn't have any more posts
      if (count >= 2) {
        const arePostArraysEqual = areArraysEqualByURL(profileData.reels, newReelsCollection)

        if (arePostArraysEqual) {
          clearInterval(scrollInterval)
          saveFinalizedData()
        }
      }

      profileData.reels = finalizePostData([
        ...profileData.reels,
        ...newReelsCollection
      ])

      // Stop at third scroll and finalize the appended post data by filtering data with same URL
      if (count >= 3) {
        clearInterval(scrollInterval);
        saveFinalizedData()
      }
    }, 2500);     
  }

  setTimeout(() => {
    // Scroll to top in case of extension is triggered to refresh the data
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Initially get the header data (name, username, bio, etc). Then collect the posts
    getHeaderData()
    scrollToBottom()
  }, 2000);
}

const extractYoutubeVideos = (request, sender, sendResponse) => {
  let profileData = {
    username: '',
    avatar: '',
    headerImg: '',
    name: '',
    bio: '',
    subscribers: '',
    totalVideos: '',
    videos: []
  }
  const getProfileData = () => {
    const extractedData = youtubeProfileBaseData()
    profileData = {
      ...profileData,
      ...extractedData,
    }
  }
  const removeEmptyData = (videos) => {
    // Remove empty data
    const finalDataset = videos.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const getProfileVideos = () => {
    const videosContainer = document.querySelector('#primary #contents')
    const videosArray = Array.from(videosContainer.children);

    if (videosArray) {
      let profileVideos = [];
      videosArray.forEach((child, index, array) => {
        const url = child.querySelector('a')?.getAttribute('href') || ''
        const views = child.querySelector('#metadata-line > span:first-of-type')?.innerText || ''
        const createdDate = child.querySelector('#metadata-line > span:last-of-type')?.innerText || ''
        const length = child.querySelector('#overlays .badge-shape-wiz__text')?.innerText || ''
        const title = child.querySelector('#video-title-link')?.innerText || ''
        const thumbnailUrl = child.querySelector('img')?.getAttribute('src')

        profileVideos.push({
          createdDate,
          title,
          length,
          thumbnailUrl,
          views: views ? views.split(' ')[0] : '',
          url: url ? `https://www.youtube.com${url}` : '',
        })
  
      });

      const cleanVideos = removeEmptyData(profileVideos)

      return cleanVideos
    } else {
      console.log('Video list not found')
      return []
    }
  }
  const finalizeVideoData = (posts) => {
    // Remove duplicate data by checking the url value
    const uniqueData = posts.reduce((acc, curr) => {
      if (!acc.some(item => item.url === curr.url)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    // Remove empty data
    const finalDataset = uniqueData.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const saveFinalizedData = () => {
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ youtubeVideos: profileData });
    sendResponse(profileData)
  }

  setTimeout(() => {
    getProfileData()
    let newVideosCollection = getProfileVideos()
    profileData.videos = finalizeVideoData([
      ...profileData.videos,
      ...newVideosCollection
    ])
    saveFinalizedData()
  }, 2000);
}

const extractYoutubeShorts = (request, sender, sendResponse) => {
  let profileData = {
    username: '',
    avatar: '',
    headerImg: '',
    name: '',
    bio: '',
    subscribers: '',
    totalVideos: '',
    shorts: []
  }
  const getProfileData = () => {
    const extractedData = youtubeProfileBaseData()
    profileData = {
      ...profileData,
      ...extractedData,
    }
  }
  const removeEmptyData = (videos) => {
    // Remove empty data
    const finalDataset = videos.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const getProfileShorts = () => {
    const shortsContainer = document.querySelector('#primary #contents')
    const shortsArray = Array.from(shortsContainer.children);

    if (shortsArray) {
      let profileShorts = [];
      shortsArray.forEach((child, index, array) => {
        const url = child.querySelector('a')?.getAttribute('href') || ''
        const views = child.querySelector('.ShortsLockupViewModelHostOutsideMetadataSubhead')?.innerText || ''
        const title = child.querySelector('h3')?.innerText || ''
        const thumbnailUrl = child.querySelector('img')?.getAttribute('src')

        profileShorts.push({
          title,
          thumbnailUrl,
          views: views ? views.split(' ')[0] : '',
          url: url ? `https://www.youtube.com${url}` : '',
        })
  
      });

      const cleanVideos = removeEmptyData(profileShorts)

      return cleanVideos
    } else {
      console.log('Shorts list not found')
      return []
    }
  }
  const finalizeVideoData = (posts) => {
    // Remove duplicate data by checking the url value
    const uniqueData = posts.reduce((acc, curr) => {
      if (!acc.some(item => item.url === curr.url)) {
        acc.push(curr);
      }
      return acc;
    }, []);

    // Remove empty data
    const finalDataset = uniqueData.filter(item => {
      return Object.values(item).some(value => Boolean(value))
    })
  
    return finalDataset;
  }
  const saveFinalizedData = () => {
    // eslint-disable-next-line no-undef
    chrome.storage.local.set({ youtubeShorts: profileData });
    sendResponse(profileData)
  }

  setTimeout(() => {
    getProfileData()
    let newShortsCollection = getProfileShorts()
    profileData.shorts = finalizeVideoData([
      ...profileData.shorts,
      ...newShortsCollection
    ])
    saveFinalizedData()
  }, 2000);
}

const actionHandlers = {
  scrapeTiktok: extractTiktokProfilePage,
  getXData: extractXProfilePage,
  getXSuggestedUsersData: extractXSuggestedUsersPage,
  closeExtensionDrawer: autoToggleExtBtn,
  scrapeLinkedinCompanyIndex: extractLinkedinCompanyIndex,
  scrapeLinkedinCompanyAbout: extractLinkedinCompanyAbout,
  scrapeLinkedinCompanyPost: extractLinkedinCompanyPost,
  scrapeLinkedinCompanyPeople: extractLinkedinCompanyPeople,
  scrapeLinkedinProfile: extractLinkedinProfile,
  scrapeLinkedinProfileActivity: extractLinkedinProfileActivity,
  scrapeFacebookGroup: extractFacebookGroup,
  scrapeFacebookPage: extractFacebookPage,
  scrapeFacebookReel: extractFacebookReel,
  scrapeFacebookReels: extractFacebookReels,
  scrapeYoutubeVideos: extractYoutubeVideos,
  scrapeYoutubeShorts: extractYoutubeShorts
}

const scrapeLinkedinBaseData = () => {
  let company = {}
  const companyImage = document.getElementsByClassName('org-top-card-primary-content__logo')[0].src
  company.logo = companyImage || ''

  const companyName = document.getElementsByClassName('org-top-card-summary__title')[0].innerText
  company.name = companyName || ''

  const companyCategory = document.getElementsByClassName('org-top-card-summary-info-list__info-item')[0].innerText
  company.category = companyCategory || ''

  const companyLocation = document.getElementsByClassName('org-top-card-summary-info-list__info-item')[1].innerText
  company.location = companyLocation || ''

  const companyFollowers = document.getElementsByClassName('org-top-card-summary-info-list__info-item')[2].innerText
  company.followers = companyFollowers || ''

  const companyEmployees = document.getElementsByClassName('org-top-card-summary-info-list__info-item')[3].innerText
  company.employees = companyEmployees || ''

  return company
}

const youtubeProfileBaseData = () => {
  let profileData = {
    username: '',
    avatar: '',
    headerImg: '',
    name: '',
    bio: '',
    subscribers: '',
    totalVideos: '',
  }

  const parentEl = document.querySelector('#page-manager #contentContainer')
  profileData.avatar = parentEl.querySelector('.yt-decorated-avatar-view-model-wiz img')?.getAttribute('src') || ''
  profileData.headerImg = parentEl.querySelector('#page-header-banner img')?.getAttribute('src') || ''
  profileData.name = parentEl.querySelector('.page-header-view-model-wiz__page-header-title')?.innerText || ''
  profileData.bio = parentEl.querySelector('.yt-description-preview-view-model-wiz span')?.innerText || ''
  const subscribersText = parentEl.querySelector('.page-header-view-model-wiz__page-header-content-metadata')?.querySelector('div:last-of-type')?.querySelector('span')?.innerText || ''
  profileData.subscribers = subscribersText ? subscribersText.split(' ')[0] : ''
  const totalVideosText = parentEl.querySelector('.page-header-view-model-wiz__page-header-content-metadata')?.querySelector('div:last-of-type')?.querySelector('span:last-of-type')?.innerText || ''
  profileData.totalVideos = totalVideosText ? totalVideosText.split(' ')[0] : ''

  return { ...profileData }
}

const init = async () => {
  const containerDiv = document.createElement("div");
  containerDiv.classList.add("mezink-global-cont");

  const iframeContainer = document.createElement("div");
  iframeContainer.classList.add("mezink-iframe-container");

  // Create and append button
  const toggleButton = document.createElement("button");
  toggleButton.setAttribute('id', 'mezink-ext-btn')
  toggleButton.classList.add("mezink-toggle-button");

  const img = document.createElement("img");
  img.src =
    "https://storage.googleapis.com/super-content/images/upload/mezink_color_1710417716.png";
  img.alt = "Mezink";
  img.classList.add("mezink-button-logo");
  toggleButton.appendChild(img);

  const buttonText = document.createElement("span");
  buttonText.textContent = "View Metrics";  
  buttonText.classList.add("mezink-button-text");
  toggleButton.appendChild(buttonText);

  toggleButton.addEventListener("click", () => {
    iframeContainer.classList.toggle("mezink-expanded");
    toggleButton.classList.toggle("mezink-button-expanded");
    if (toggleButton.classList.contains("mezink-button-expanded")) {
      // eslint-disable-next-line no-undef
      chrome.runtime.sendMessage({ action: 'updateUrl' });
      buttonText.textContent = "✕";
      img.style.display = "none";
    } else {
      buttonText.textContent = "View Metrics";
      img.style.display = "inline";
    }
  });

  containerDiv.appendChild(toggleButton);

  const iframe = document.createElement("iframe");
  iframe.classList.add("mezink-iframe");
  // eslint-disable-next-line no-undef
  iframe.src = chrome.runtime.getURL("index.html");
  iframe.allow = "clipboard-read; clipboard-write";

  iframeContainer.appendChild(iframe);
  containerDiv.appendChild(iframeContainer);

  document.body.appendChild(containerDiv);
  
  // eslint-disable-next-line no-undef
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = actionHandlers[message.action]
    if (handler) {
      return handler(message, sender, sendResponse)
    }
  });
};

init();   