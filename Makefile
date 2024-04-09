SHELL := /bin/bash

build:
	@npm run build

package: build
	@npm run package

test: build
	@lambda/build
	@cd test && npm run build && cdk deploy

clean:
	@rm -rf node_modules package-lock.json test/node_modules test/package-lock.json

install: clean
	@npm i
	@cd test && npm i

eslint:
	@echo -e "$(TARGET_COLOR)Running eslint $$(npx eslint --version)$(NO_COLOR)"
	@npx eslint .; \
	echo "Passed"
