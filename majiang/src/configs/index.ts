/**
 * 开发and生产配置
 */

const Applets = {
	dev: "dev",
	test: "test",
	prod: "prod",
};

const env = "dev"  //"prod"

interface AppConfig {
	dev: {
		[key: string]: string | number,
	},
	test: {
		[key: string]: string | number,
	},
	prod: {
		[key: string]: string | number,
	},
}

const hostname = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

const appConfig: AppConfig = {
	dev: {
		"host": `http://${hostname}`,
		"port": 4000,
		"ws": `ws://${hostname}:8082`,
	},
	test: {
		"host": `http://${hostname}`,
		"port": 4000,
		"ws": `ws://${hostname}:8082`,
	},
	prod: {
		"host": `http://${hostname}`,
		"port": 4000,
		"ws": `ws://${hostname}:8082`,
	}
};

export default appConfig[env]
