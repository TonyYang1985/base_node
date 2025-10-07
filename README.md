# basenode


# README #

## Please follow the step by step to startup your fotapi project.

* Set fot npm private repository
++++
Already set configs in project level .npmrc & .yarnrc.
Change the npm password by setting env if you need to submit code.
++++
[source, shell]
----
echo -n 'myuser:mypassword' | openssl base64
npm_config__auth=xxxxxx yarn publish
----

yarn publish --access  restricted

----
* Install yarn packages
[source, shell]
----
yarn install
----

* Set up your marinedb and import the sql data in file mysqlsampledatabase.sql, then change the db address in ./cfg/database.development.yaml

* Run project
[source, shell]
----
yarn dev
----



## Document links
* Restful controller: 
https://github.com/typestack/routing-controllers/blob/master/README.md[routing-controllers] 
* Socket.io controller:
https://github.com/typestack/socket-controllers/blob/master/README.md[socket-controllers]
* Validation: https://github.com/typestack/class-validator/blob/master/README.md[class-validator]
* Json <-> Object: https://github.com/typestack/class-transformer/blob/develop/README.md[class-transformer]
* socket.io: https://socket.io/docs/[socket.io]
* IoC: https://github.com/typestack/typedi/blob/master/README.md[typedi]
* ORM: 
** https://typeorm.io/[typeorm] 
** https://github.com/odavid/typeorm-transactional-cls-hooked/blob/master/README.md[tx decorators]
** https://github.com/typeorm/typeorm-typedi-extensions/blob/master/README.md[inject repo/conn]



## Dev
http://localhost:3000/api/v1/example/query/roles