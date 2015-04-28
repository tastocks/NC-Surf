function hover() {
 alert("This icon shows the current tab number. Clicking toggles whether or not this extension operates only in incognito mode.");
 if (IncognitoOnly) IncognitoOnly=false;
 else IncognitoOnly=true;
}
document.addEventListener('DOMContentLoaded', function () {
  hover();
});
