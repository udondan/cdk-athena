clean:
	@rm -rf ../node_modules ../package-lock.json
	@rm -rf node_modules package-lock.json
	@find .. \( -name "*.js" -o -name "*.d.ts" \) -type f -delete

install: package
	@echo Installing dependencies...
	@npm install ../cdk-athena-test.tgz --no-save --prefer-offline --cache ../.npm
	@npm list

build: lambda
	@echo Building application...
	@npm run build

diff: build
	@echo Running diff...
	@AWS_REGION=us-east-1 npm run cdk -- diff

deploy: build
	@echo Deploying application...
	@AWS_REGION=us-east-1 npm run cdk -- deploy --require-approval never

DESTROY: build
	@echo Destroying application...
	@AWS_REGION=us-east-1 npm run cdk -- destroy --force

lambda:
	@echo Building Lambda...
	@../lambda/build

package:
	@echo Building npm tgz...
	@ \
	cd .. && \
	make install build && \
	npm pack && \
	mv cdk-athena-*.tgz cdk-athena-test.tgz
