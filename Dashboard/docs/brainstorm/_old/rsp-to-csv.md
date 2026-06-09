NOTE that interanllay program id is the key (as per user's nomaclature, we're recently JUST changed the label to job number in the database upload panel) 

Requirement 1:
In the database route, in the upload panel, the user should also be able to upload a folder consiting ing .rsp files as well in addition to the currently accepted .csv files. 
HOEVER in this case we'll need an addendum to the the data extraction pipeline after detecting the file type in the uploaded folder or single file 


Requirement 2:
NOTE that users can upload single .csv or .rsp file and a folder with either all .csv or .rsp files  (IN CASE there are mixed .csv and .rsp, NOTIF the user that only a SINGLE type of file format should be present - NOTE that this does not include the channel_map.yml since this is used for mapping .csv file channel columns to the correct database plot axes). 

    IF a single .csv file is uploaded, user will stil have to enter the required input fields (based on these inputs, ENSURE that if this data belongs to an already created program and version, that is is added to the correct group. ON the other hand if it is a new program or version, ENSURE that gets added to the database according to the exisitng flow). HOWEVER, if the uploaded file is a .rsp file, then added it to the data/rsp_raw UNDER THE correct program id and version number. FOR the .rsp files in the rsp_raw directory, NOTE that these are not added to the database immediately, before being added to the database, they need to be converted to .csv files and stored under the appropriate program id and version folder in data/raw. ONCE this is done, the data can be added to the database. 

    THESE steps should be indicated visually in the database page in teh UI so that the user is aware of the steps that are taking place (so expand the current reporting approach)

