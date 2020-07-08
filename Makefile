SHELL := /bin/bash
VERSION := $(shell cat VERSION)

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

tag:
	@git tag -a "v$(VERSION)" -m 'Creates tag "v$(VERSION)"'
	@git push --tags

untag:
	@git push --delete origin "v$(VERSION)"
	@git tag --delete "v$(VERSION)"

release: tag

re-release: untag tag
