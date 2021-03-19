install:
	@cd .. && npm i

build: install
	@npm run build

diff: build
	@cdk diff

deploy: build
	@cdk deploy --require-approval never

DESTROY: build
	@cdk destroy --force

lambda:
	@../lambda/build
