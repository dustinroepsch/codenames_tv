# Hosting

The frontend and backend will be hosted on a VPS using docker compose.
Swag (https://docs.linuxserver.io/general/swag) will be used as a reverse proxy.
The domain name is codejack.net. 

The frontend will have a docker file that does a release build and mounts a shared directory that is also mounted by swag. Swag will serve the compiled website on codejack.net

api.codejack.net will be forwarded to the docker container thats running the rust backend
