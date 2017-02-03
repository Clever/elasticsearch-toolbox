# usage:
# `make` or `make test` runs all the tests
# `make api` runs just that test

include node.mk
.DEFAULT_GOAL := test

NODE_VERSION := "v6"

$(eval $(call node-version-check,$(NODE_VERSION)))

.PHONY: test build lint $(TESTS)
TS_FILES := $(shell find . -name "*.ts" -not -path "./node_modules/*" -not -path "./typings/*")
TESTS = $(patsubst %.ts,%,$(wildcard test/*.ts))
TEST_ENV = env ELASTICSEARCH_URL=http://test-es-server ELASTICSEARCH_USER="" ELASTICSEARCH_PASSWORD=""

all: build test

build:
	npm install

run:
	npm run-script dev-server

lint:
	./node_modules/.bin/tslint $(TS_FILES)
	./node_modules/.bin/eslint $(TS_FILES)

format:
	./node_modules/.bin/prettier --bracket-spacing false --write $(TS_FILES)
	./node_modules/.bin/eslint --fix $(TS_FILES)

test: lint $(TESTS)

$(TESTS):
	$(TEST_ENV) node_modules/mocha/bin/mocha --require ts-node/register --ignore-leaks --timeout 1000 $@.ts
